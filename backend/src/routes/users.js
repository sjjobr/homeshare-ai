/**
 * backend/src/routes/users.js
 * User profile management routes.
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const auth = require('../middleware/auth');

// GET /api/users/profile - get own profile
router.get('/profile', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, role, phone, date_of_birth,
              city, state, zip_code, bio, avatar_url, onboarding_complete,
              budget_min, budget_max, move_in_date, lifestyle_preferences,
              helper_exchange, created_at
       FROM users WHERE id = $1`,
      [req.user.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    res.json({
      id: u.id,
      email: u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      role: u.role,
      phone: u.phone,
      dateOfBirth: u.date_of_birth,
      city: u.city,
      state: u.state,
      zipCode: u.zip_code,
      bio: u.bio,
      avatarUrl: u.avatar_url,
      onboardingComplete: u.onboarding_complete,
      budgetMin: u.budget_min,
      budgetMax: u.budget_max,
      moveInDate: u.move_in_date,
      lifestylePreferences: u.lifestyle_preferences,
      helperExchange: u.helper_exchange,
      createdAt: u.created_at,
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/profile - update own profile
router.put('/profile', auth, async (req, res) => {
  try {
    const {
      firstName, lastName, phone, city, state, zipCode, bio,
      budgetMin, budgetMax, moveInDate, lifestylePreferences, helperExchange,
    } = req.body;

    const result = await pool.query(
      `UPDATE users SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        phone = COALESCE($3, phone),
        city = COALESCE($4, city),
        state = COALESCE($5, state),
        zip_code = COALESCE($6, zip_code),
        bio = COALESCE($7, bio),
        budget_min = COALESCE($8, budget_min),
        budget_max = COALESCE($9, budget_max),
        move_in_date = COALESCE($10, move_in_date),
        lifestyle_preferences = COALESCE($11, lifestyle_preferences),
        helper_exchange = COALESCE($12, helper_exchange),
        updated_at = NOW()
       WHERE id = $13
       RETURNING id, email, first_name, last_name, role, city, state, bio, avatar_url, onboarding_complete`,
      [
        firstName, lastName, phone, city, state, zipCode, bio,
        budgetMin, budgetMax, moveInDate,
        lifestylePreferences ? JSON.stringify(lifestylePreferences) : null,
        helperExchange !== undefined ? helperExchange : null,
        req.user.userId,
      ]
    );

    const u = result.rows[0];
    res.json({
      id: u.id, email: u.email, firstName: u.first_name, lastName: u.last_name,
      role: u.role, city: u.city, state: u.state, bio: u.bio,
      avatarUrl: u.avatar_url, onboardingComplete: u.onboarding_complete,
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/me - get own profile (used by frontend after login/onboarding)
router.get('/me', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, role, phone, date_of_birth,
              city, state, zip_code, bio, avatar_url, onboarding_complete,
              budget_min, budget_max, move_in_date, lifestyle_preferences,
              helper_exchange, created_at
       FROM users WHERE id = $1`,
      [req.user.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    res.json({
      id: u.id,
      email: u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      role: u.role,
      phone: u.phone,
      dateOfBirth: u.date_of_birth,
      city: u.city,
      state: u.state,
      zipCode: u.zip_code,
      bio: u.bio,
      avatarUrl: u.avatar_url,
      onboardingComplete: u.onboarding_complete,
      budgetMin: u.budget_min,
      budgetMax: u.budget_max,
      moveInDate: u.move_in_date,
      lifestylePreferences: u.lifestyle_preferences,
      helperExchange: u.helper_exchange,
      createdAt: u.created_at,
    });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/users/me - partial update of own profile (used by onboarding flow)
router.patch('/me', auth, async (req, res) => {
  try {
    const {
      role, onboardingCompleted,
      firstName, lastName, phone, city, state, zipCode, bio,
      budgetMin, budgetMax, moveInDate, lifestylePreferences, helperExchange,
    } = req.body;

    if (role && !['host', 'guest'].includes(role)) {
      return res.status(400).json({ error: 'Role must be host or guest' });
    }

    const result = await pool.query(
      `UPDATE users SET
        role = COALESCE($1, role),
        onboarding_complete = COALESCE($2, onboarding_complete),
        first_name = COALESCE($3, first_name),
        last_name = COALESCE($4, last_name),
        phone = COALESCE($5, phone),
        city = COALESCE($6, city),
        state = COALESCE($7, state),
        zip_code = COALESCE($8, zip_code),
        bio = COALESCE($9, bio),
        budget_min = COALESCE($10, budget_min),
        budget_max = COALESCE($11, budget_max),
        move_in_date = COALESCE($12, move_in_date),
        lifestyle_preferences = COALESCE($13, lifestyle_preferences),
        helper_exchange = COALESCE($14, helper_exchange),
        updated_at = NOW()
       WHERE id = $15
       RETURNING id, email, first_name, last_name, role, phone, city, state, zip_code,
                 bio, avatar_url, onboarding_complete, budget_min, budget_max,
                 move_in_date, lifestyle_preferences, helper_exchange, created_at`,
      [
        role || null,
        onboardingCompleted === undefined ? null : onboardingCompleted,
        firstName || null, lastName || null, phone || null,
        city || null, state || null, zipCode || null, bio || null,
        budgetMin ?? null, budgetMax ?? null, moveInDate || null,
        lifestylePreferences ? JSON.stringify(lifestylePreferences) : null,
        helperExchange === undefined ? null : helperExchange,
        req.user.userId,
      ]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    res.json({
      id: u.id,
      email: u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      role: u.role,
      phone: u.phone,
      city: u.city,
      state: u.state,
      zipCode: u.zip_code,
      bio: u.bio,
      avatarUrl: u.avatar_url,
      onboardingComplete: u.onboarding_complete,
      budgetMin: u.budget_min,
      budgetMax: u.budget_max,
      moveInDate: u.move_in_date,
      lifestylePreferences: u.lifestyle_preferences,
      helperExchange: u.helper_exchange,
      createdAt: u.created_at,
    });
  } catch (err) {
    console.error('Patch profile error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/:id - get public profile of another user
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.get('/:id', auth, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'User not found' });
  try {
    const result = await pool.query(
      `SELECT id, first_name, last_name, role, city, state, bio, avatar_url, created_at
       FROM users WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    res.json({
      id: u.id,
      firstName: u.first_name,
      lastName: u.last_name,
      role: u.role,
      city: u.city,
      state: u.state,
      bio: u.bio,
      avatarUrl: u.avatar_url,
      memberSince: u.created_at,
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
