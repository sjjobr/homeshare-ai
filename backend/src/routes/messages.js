const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { pool } = require('../db/pool');

// GET /api/messages/:matchId - get messages for a match
router.get('/:matchId', auth, async (req, res) => {
  try {
    const match = await pool.query('SELECT * FROM matches WHERE id = $1', [req.params.matchId]);
    if (match.rows.length === 0) return res.status(404).json({ error: 'Match not found' });

    const m = match.rows[0];
    if (m.host_id !== req.user.userId && m.guest_id !== req.user.userId) {
      return res.status(403).json({ error: 'Not your match' });
    }

    // Mark as read
    await pool.query(
      'UPDATE messages SET read_at = NOW() WHERE match_id = $1 AND recipient_id = $2 AND read_at IS NULL',
      [req.params.matchId, req.user.userId]
    );

    const result = await pool.query(
      `SELECT msg.*, u.first_name, u.last_name, u.avatar_url
       FROM messages msg
       JOIN users u ON u.id = msg.sender_id
       WHERE msg.match_id = $1
       ORDER BY msg.created_at ASC`,
      [req.params.matchId]
    );
    res.json({ messages: result.rows });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/messages - send a message
router.post('/', auth, async (req, res) => {
  try {
    const { matchId, content, messageType = 'text' } = req.body;

    if (!matchId || !content) {
      return res.status(400).json({ error: 'matchId and content are required' });
    }

    const match = await pool.query('SELECT * FROM matches WHERE id = $1', [matchId]);
    if (match.rows.length === 0) return res.status(404).json({ error: 'Match not found' });

    const m = match.rows[0];
    if (m.host_id !== req.user.userId && m.guest_id !== req.user.userId) {
      return res.status(403).json({ error: 'Not your match' });
    }

    const recipientId = m.host_id === req.user.userId ? m.guest_id : m.host_id;

    const result = await pool.query(
      `INSERT INTO messages (match_id, sender_id, recipient_id, content, message_type)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [matchId, req.user.userId, recipientId, content, messageType]
    );

    // Update match last_message_at
    await pool.query('UPDATE matches SET updated_at = NOW() WHERE id = $1', [matchId]);

    const msgWithUser = await pool.query(
      `SELECT msg.*, u.first_name, u.last_name, u.avatar_url
       FROM messages msg JOIN users u ON u.id = msg.sender_id WHERE msg.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json(msgWithUser.rows[0]);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/messages - get all conversations (unread counts)
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.id as match_id,
        CASE WHEN m.host_id = $1 THEN m.guest_id ELSE m.host_id END as other_user_id,
        u.first_name, u.last_name, u.avatar_url,
        (SELECT content FROM messages WHERE match_id = m.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE match_id = m.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
        (SELECT COUNT(*) FROM messages WHERE match_id = m.id AND recipient_id = $1 AND read_at IS NULL) as unread_count
       FROM matches m
       JOIN users u ON u.id = CASE WHEN m.host_id = $1 THEN m.guest_id ELSE m.host_id END
       WHERE (m.host_id = $1 OR m.guest_id = $1) AND m.status = 'connected'
       ORDER BY last_message_at DESC NULLS LAST`,
      [req.user.userId]
    );
    res.json({ conversations: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
