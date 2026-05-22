const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { pool } = require('../db/pool');

// GET /api/listings - get all active listings (with filters)
router.get('/', async (req, res) => {
  try {
    const { city, state, minRent, maxRent, helperExchange, limit = 20, offset = 0 } = req.query;
    let query = `
      SELECT l.*, u.first_name, u.last_name, u.avatar_url, u.city as host_city, u.state as host_state
      FROM listings l
      JOIN users u ON l.host_id = u.id
      WHERE l.is_active = true
    `;
    const params = [];
    let idx = 1;

    if (city) { query += ` AND l.city ILIKE $${idx++}`; params.push(`%${city}%`); }
    if (state) { query += ` AND l.state = $${idx++}`; params.push(state); }
    if (minRent) { query += ` AND l.monthly_rent_cents >= $${idx++}`; params.push(parseInt(minRent) * 100); }
    if (maxRent) { query += ` AND l.monthly_rent_cents <= $${idx++}`; params.push(parseInt(maxRent) * 100); }
    if (helperExchange === 'true') { query += ` AND l.helper_exchange_available = true`; }

    query += ` ORDER BY l.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    res.json({ listings: result.rows, count: result.rowCount });
  } catch (err) {
    console.error('Get listings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/listings/:id - get single listing
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, u.first_name, u.last_name, u.avatar_url, u.bio as host_bio, u.city as host_city, u.state as host_state
       FROM listings l JOIN users u ON l.host_id = u.id WHERE l.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Listing not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/listings - create listing (host only)
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'host') return res.status(403).json({ error: 'Only hosts can create listings' });
    const {
      title, description, address, city, state, zipCode, country = 'US',
      monthlyRentCents, depositCents, roomType, totalRooms, bathroomType,
      squareFootage, isFurnished, utilitiesIncluded, petsAllowed,
      smokingAllowed, helperExchangeAvailable, helperExchangeDetails,
      availableFrom, availableTo, photos
    } = req.body;

    const result = await pool.query(
      `INSERT INTO listings (
        host_id, title, description, address, city, state, zip_code, country,
        monthly_rent_cents, deposit_cents, room_type, total_rooms, bathroom_type,
        square_footage, is_furnished, utilities_included, pets_allowed,
        smoking_allowed, helper_exchange_available, helper_exchange_details,
        available_from, available_to, photos
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      RETURNING *`,
      [req.user.userId, title, description, address, city, state, zipCode, country,
       monthlyRentCents, depositCents, roomType, totalRooms, bathroomType,
       squareFootage, isFurnished, utilitiesIncluded, petsAllowed, smokingAllowed,
       helperExchangeAvailable, helperExchangeDetails, availableFrom, availableTo,
       JSON.stringify(photos || [])]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create listing error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/listings/:id - update listing
router.put('/:id', auth, async (req, res) => {
  try {
    const listing = await pool.query('SELECT * FROM listings WHERE id = $1', [req.params.id]);
    if (listing.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (listing.rows[0].host_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });

    const fields = req.body;
    const updates = [];
    const values = [];
    let idx = 1;

    const allowedFields = ['title','description','monthly_rent_cents','is_active','photos',
      'helper_exchange_available','helper_exchange_details','available_from','available_to',
      'pets_allowed','smoking_allowed','is_furnished'];

    for (const [key, val] of Object.entries(fields)) {
      const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(col)) {
        updates.push(`${col} = $${idx++}`);
        values.push(val);
      }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    values.push(req.params.id);

    const result = await pool.query(
      `UPDATE listings SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/listings/:id - deactivate listing
router.delete('/:id', auth, async (req, res) => {
  try {
    const listing = await pool.query('SELECT * FROM listings WHERE id = $1', [req.params.id]);
    if (listing.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (listing.rows[0].host_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
    await pool.query('UPDATE listings SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ message: 'Listing deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
