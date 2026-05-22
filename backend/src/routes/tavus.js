/**
 * backend/src/routes/tavus.js
 * Routes for Tavus CVI conversation management and webhook handling.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { pool } = require('../db/pool');
const auth = require('../middleware/auth');
const tavusService = require('../services/tavusService');
const matchingService = require('../services/matchingService');

// -----------------------------------------------------------------------
// POST /api/tavus/conversation
// Creates a new Tavus CVI conversation for the authenticated user.
// -----------------------------------------------------------------------
router.post('/conversation', auth, async (req, res) => {
  try {
    const { userId, role } = req.user;

    // Get user's name
    const userResult = await pool.query(
      'SELECT first_name, last_name FROM users WHERE id = $1',
      [userId]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const { first_name, last_name } = userResult.rows[0];

    const webhookUrl = `${process.env.APP_BASE_URL}/api/tavus/webhook`;

    const conversation = await tavusService.createConversation({
      userId,
      role,
      userName: `${first_name} ${last_name}`,
      webhookUrl,
    });

    // Persist conversation record
    await pool.query(
      `INSERT INTO tavus_conversations (user_id, tavus_conversation_id, persona_id, replica_id, status)
       VALUES ($1, $2, $3, $4, 'active')`,
      [userId, conversation.conversationId, process.env.TAVUS_PERSONA_ID, process.env.TAVUS_REPLICA_ID]
    );

    // Also update the user's tavus_conversation_id
    await pool.query(
      'UPDATE users SET tavus_conversation_id = $1 WHERE id = $2',
      [conversation.conversationId, userId]
    );

    res.json({
      conversationId: conversation.conversationId,
      conversationUrl: conversation.conversationUrl,
    });
  } catch (error) {
    console.error('Error creating Tavus conversation:', error.message);
    if (error.response) {
      console.error('Tavus API response status:', error.response.status);
      console.error('Tavus API response body:', JSON.stringify(error.response.data, null, 2));
    }
    res.status(500).json({ error: 'Failed to start conversation', details: error.response?.data });
  }
});

// -----------------------------------------------------------------------
// GET /api/tavus/conversation/:id
// Fetches the status of a specific conversation.
// -----------------------------------------------------------------------
router.get('/conversation/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM tavus_conversations WHERE tavus_conversation_id = $1 AND user_id = $2',
      [id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const record = result.rows[0];

    // Fetch live status from Tavus API
    let liveStatus = record.status;
    try {
      const liveData = await tavusService.getConversation(id);
      liveStatus = liveData.status || record.status;
    } catch (e) {
      // Tavus API error — use local status
    }

    res.json({
      id: record.id,
      conversationId: id,
      status: liveStatus,
      extractedData: record.extracted_data,
      startedAt: record.started_at,
      endedAt: record.ended_at,
    });
  } catch (error) {
    console.error('Error fetching conversation:', error.message);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// -----------------------------------------------------------------------
// POST /api/tavus/conversation/:id/end
// Manually ends an active conversation.
// -----------------------------------------------------------------------
router.post('/conversation/:id/end', auth, async (req, res) => {
  try {
    const { id } = req.params;
    await tavusService.endConversation(id);

    await pool.query(
      "UPDATE tavus_conversations SET status = 'ended', ended_at = NOW() WHERE tavus_conversation_id = $1 AND user_id = $2",
      [id, req.user.userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error ending conversation:', error.message);
    res.status(500).json({ error: 'Failed to end conversation' });
  }
});

// -----------------------------------------------------------------------
// POST /api/tavus/webhook
// Receives the conversation transcript from Tavus when conversation ends.
// Called by Tavus servers, NOT the frontend.
// -----------------------------------------------------------------------
router.post('/webhook', async (req, res) => {
  try {
    // Verify webhook signature
    const webhookSecret = process.env.TAVUS_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers['x-tavus-signature'];
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
      const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');

      if (signature !== expectedSig) {
        console.warn('Invalid Tavus webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const payload = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;
    const parsed = tavusService.parseWebhookPayload(payload);
    // user_id arrives as a query param on the callback URL (modern Tavus API)
    const userId = parsed.userId || req.query.user_id;
    const { conversationId, status, transcript, extractedData } = parsed;

    if (!userId || !conversationId) {
      return res.status(400).json({ error: 'Missing userId or conversationId' });
    }

    // Update conversation record
    await pool.query(
      `UPDATE tavus_conversations
       SET status = $1, raw_transcript = $2, extracted_data = $3, ended_at = CASE WHEN $1 = 'ended' THEN NOW() ELSE ended_at END
       WHERE tavus_conversation_id = $4`,
      [status === 'ended' ? 'ended' : 'active', transcript, JSON.stringify(extractedData), conversationId]
    );

    // Auto-populate user profile and run matching
    if (extractedData && status === 'ended') {
      await updateUserProfile(userId, extractedData);
      await matchingService.generateMatchesForUser(userId);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error.message);
    res.json({ received: true, error: error.message });
  }
});

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
async function updateUserProfile(userId, data) {
  const tags = [];
  if (data.lifestyle?.quiet) tags.push('quiet');
  if (data.lifestyle?.social) tags.push('social');
  if (data.lifestyle?.hasPets) tags.push('has-pets');
  if (data.lifestyle?.earlyRiser) tags.push('early-riser');
  if (data.helperExchange) tags.push('open-to-helper');

  await pool.query(
    `UPDATE users SET
       onboarding_complete = true,
       bio = COALESCE($1, bio),
       personality_tags = $2,
       lifestyle_preferences = $3,
       helper_exchange = $4,
       updated_at = NOW()
     WHERE id = $5`,
    [
      data.bio || null,
      tags,
      data.lifestyle ? JSON.stringify(data.lifestyle) : null,
      data.helperExchange || false,
      userId,
    ]
  );

  // If guest, update budget
  if (data.role === 'guest' && data.budget) {
    await pool.query(
      'UPDATE users SET budget_max = $1 WHERE id = $2',
      [data.budget * 100, userId] // store in cents
    );
  }
}

module.exports = router;
