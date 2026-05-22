const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { pool } = require('../db/pool');
const { findMatches } = require('../services/matchingService');

// GET /api/matches - get matches for current user
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*,
        CASE WHEN m.host_id = $1 THEN m.guest_id ELSE m.host_id END as other_user_id,
        u.first_name, u.last_name, u.avatar_url, u.bio,
        l.title as listing_title, l.city, l.state, l.monthly_rent_cents
       FROM matches m
       JOIN users u ON u.id = CASE WHEN m.host_id = $1 THEN m.guest_id ELSE m.host_id END
       LEFT JOIN listings l ON l.id = m.listing_id
       WHERE m.host_id = $1 OR m.guest_id = $1
       ORDER BY m.compatibility_score DESC`,
      [req.user.userId]
    );
    res.json({ matches: result.rows });
  } catch (err) {
    console.error('Get matches error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/matches/generate - run matching algorithm
router.post('/generate', auth, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = userResult.rows[0];
    if (!user.onboarding_complete) {
      return res.status(400).json({ error: 'Complete onboarding before generating matches' });
    }

    const matches = await findMatches(user, pool);
    res.json({ matches, count: matches.length });
  } catch (err) {
    console.error('Generate matches error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/matches/:id/status - update match status (like/pass/connect)
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'liked', 'passed', 'connected', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const match = await pool.query('SELECT * FROM matches WHERE id = $1', [req.params.id]);
    if (match.rows.length === 0) return res.status(404).json({ error: 'Match not found' });

    const m = match.rows[0];
    if (m.host_id !== req.user.userId && m.guest_id !== req.user.userId) {
      return res.status(403).json({ error: 'Not your match' });
    }

    const result = await pool.query(
      'UPDATE matches SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
