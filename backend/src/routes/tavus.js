/**
 * backend/src/routes/tavus.js
 * Routes for Tavus CVI conversation management and webhook handling.
 */

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma        = new PrismaClient();
const tavusService  = require('../services/tavusService');
const matchingService = require('../services/matchingService');
const { requireAuth } = require('../middleware/auth');

// -----------------------------------------------------------------------
// POST /api/tavus/conversation
// Creates a new Tavus CVI conversation for the authenticated user.
// Called when the user lands on the onboarding page.
// -----------------------------------------------------------------------
router.post('/conversation', requireAuth, async (req, res) => {
  try {
    const user = req.user;

    // Build the webhook URL that Tavus will call when conversation ends
    const webhookUrl = `${process.env.APP_BASE_URL}/api/tavus/webhook`;

    const conversation = await tavusService.createConversation({
      userId:     user.id,
      role:       user.role,
      userName:   `${user.first_name} ${user.last_name}`,
      webhookUrl,
    });

    // Persist conversation record
    await prisma.tavusConversation.create({
      data: {
        userId:               user.id,
        tavusConversationId:  conversation.conversationId,
        personaId:            process.env.TAVUS_PERSONA_ID,
        replicaId:            process.env.TAVUS_REPLICA_ID,
        status:               'active',
      },
    });

    res.json({
      conversationId:  conversation.conversationId,
      conversationUrl: conversation.conversationUrl,
    });
  } catch (error) {
    console.error('Error creating Tavus conversation:', error.message);
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});

// -----------------------------------------------------------------------
// GET /api/tavus/conversation/:id
// Fetches the status and metadata of a specific conversation.
// -----------------------------------------------------------------------
router.get('/conversation/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const localRecord = await prisma.tavusConversation.findFirst({
      where: {
        tavusConversationId: id,
        userId: req.user.id,
      },
    });

    if (!localRecord) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Also fetch live status from Tavus API
    const liveData = await tavusService.getConversation(id);

    res.json({
      id:             localRecord.id,
      conversationId: id,
      status:         liveData.status || localRecord.status,
      extractedData:  localRecord.extractedData,
      startedAt:      localRecord.startedAt,
      endedAt:        localRecord.endedAt,
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
router.post('/conversation/:id/end', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    await tavusService.endConversation(id);

    await prisma.tavusConversation.updateMany({
      where: { tavusConversationId: id, userId: req.user.id },
      data:  { status: 'ended', endedAt: new Date() },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error ending conversation:', error.message);
    res.status(500).json({ error: 'Failed to end conversation' });
  }
});

// -----------------------------------------------------------------------
// POST /api/tavus/webhook
// Receives the conversation transcript and extracted data from Tavus.
// This is called by Tavus servers, NOT by the frontend.
// -----------------------------------------------------------------------
router.post('/webhook', async (req, res) => {
  try {
    // Verify the webhook signature (optional but recommended)
    const webhookSecret = process.env.TAVUS_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers['x-tavus-signature'];
      const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (signature !== expectedSig) {
        console.warn('Invalid Tavus webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // Parse the payload
    const { userId, conversationId, status, transcript, extractedData } =
      tavusService.parseWebhookPayload(req.body);

    if (!userId || !conversationId) {
      return res.status(400).json({ error: 'Missing userId or conversationId' });
    }

    // Update the conversation record with the transcript and extracted data
    await prisma.tavusConversation.updateMany({
      where: { tavusConversationId: conversationId },
      data: {
        status:        status === 'ended' ? 'ended' : 'active',
        rawTranscript: transcript,
        extractedData: extractedData,
        endedAt:       status === 'ended' ? new Date() : undefined,
      },
    });

    // Auto-populate the user profile with extracted data
    if (extractedData && status === 'ended') {
      await updateUserProfile(userId, extractedData);

      // Run the matching algorithm after onboarding completes
      await matchingService.generateMatchesForUser(userId);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error.message);
    // Always respond 200 to Tavus to prevent retries for logic errors
    res.json({ received: true, error: error.message });
  }
});

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
async function updateUserProfile(userId, data) {
  const updateData = {
    onboardingCompleted: true,
    bio: data.bio || undefined,
    personalityTags: buildPersonalityTags(data),
    lifestyleScore: data.lifestyle || {},
  };

  await prisma.user.update({
    where: { id: userId },
    data:  updateData,
  });

  // If they are a guest, also update their budget preference
  if (data.role === 'guest' && data.budget) {
    await prisma.guestPreference.upsert({
      where:  { userId },
      update: { maxBudget: data.budget * 100 }, // store in cents
      create: { userId, maxBudget: data.budget * 100 },
    });
  }
}

function buildPersonalityTags(data) {
  const tags = [];
  if (data.lifestyle?.quiet)      tags.push('quiet');
  if (data.lifestyle?.social)     tags.push('social');
  if (data.lifestyle?.hasPets)    tags.push('has-pets');
  if (data.lifestyle?.earlyRiser) tags.push('early-riser');
  if (data.helperExchange)        tags.push('open-to-helper');
  return tags;
}

module.exports = router;
