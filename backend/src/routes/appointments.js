/**
 * backend/src/routes/appointments.js
 * Appointment management routes.
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { pool } = require('../db/pool');

// GET /api/appointments - get user's appointments
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*,
        u.first_name as other_first_name, u.last_name as other_last_name, u.avatar_url as other_avatar,
        l.title as listing_title, l.address as listing_address, l.city, l.state
       FROM appointments a
       JOIN users u ON u.id = CASE WHEN a.host_id = $1 THEN a.guest_id ELSE a.host_id END
       LEFT JOIN listings l ON l.id = a.listing_id
       WHERE a.host_id = $1 OR a.guest_id = $1
       ORDER BY a.scheduled_at ASC`,
      [req.user.userId]
    );
    res.json({ appointments: result.rows });
  } catch (err) {
    console.error('Get appointments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/appointments - create appointment
router.post('/', auth, async (req, res) => {
  try {
    const { matchId, scheduledAt, durationMins = 60, notes, type = 'video_call' } = req.body;

    if (!matchId || !scheduledAt) {
      return res.status(400).json({ error: 'matchId and scheduledAt are required' });
    }

    const match = await pool.query('SELECT * FROM matches WHERE id = $1', [matchId]);
    if (match.rows.length === 0) return res.status(404).json({ error: 'Match not found' });

    const m = match.rows[0];
    if (m.host_id !== req.user.userId && m.guest_id !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const validTypes = ['video_call', 'in_person'];
    const apptType = validTypes.includes(type) ? type : 'video_call';

    const result = await pool.query(
      `INSERT INTO appointments (match_id, host_id, guest_id, listing_id, scheduled_at, duration_mins, notes, type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [matchId, m.host_id, m.guest_id, m.listing_id, scheduledAt, durationMins, notes || null, apptType]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create appointment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/appointments/:id - update appointment
router.put('/:id', auth, async (req, res) => {
  try {
    const { status, scheduledAt, notes } = req.body;
    const appt = await pool.query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
    if (appt.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const a = appt.rows[0];
    if (a.host_id !== req.user.userId && a.guest_id !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updates = [];
    const values = [];
    let idx = 1;

    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'];
    if (status && validStatuses.includes(status)) {
      updates.push(`status = $${idx++}`);
      values.push(status);
    }
    if (scheduledAt) { updates.push(`scheduled_at = $${idx++}`); values.push(scheduledAt); }
    if (notes !== undefined) { updates.push(`notes = $${idx++}`); values.push(notes); }

    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    values.push(req.params.id);

    const result = await pool.query(
      `UPDATE appointments SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/appointments/:id - cancel appointment
router.delete('/:id', auth, async (req, res) => {
  try {
    const { reason } = req.body;
    const appt = await pool.query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
    if (appt.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const a = appt.rows[0];
    if (a.host_id !== req.user.userId && a.guest_id !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await pool.query(
      "UPDATE appointments SET status = 'cancelled', cancelled_by = $1, cancel_reason = $2, updated_at = NOW() WHERE id = $3",
      [req.user.userId, reason || null, req.params.id]
    );
    res.json({ message: 'Appointment cancelled' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
