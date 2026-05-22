/**
 * matchingService.js
 * Compatibility scoring between Hosts and Guests.
 * Uses pg pool directly — no ORM.
 */

const { pool } = require('../db/pool');

// Weights for each compatibility dimension (must sum to 100)
const WEIGHTS = {
  budget: 30,
  lifestyle: 35,
  location: 15,
  rules: 20,
};

// -----------------------------------------------------------------------
// generateMatchesForUser
// Called after a user completes onboarding.
// -----------------------------------------------------------------------
async function generateMatchesForUser(userId) {
  const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  if (userResult.rows.length === 0) return;

  const user = userResult.rows[0];
  if (!user.onboarding_complete) return;

  if (user.role === 'guest') {
    await matchGuestToListings(user);
  } else if (user.role === 'host') {
    await matchHostListingsToGuests(user);
  }
}

// -----------------------------------------------------------------------
// matchGuestToListings
// -----------------------------------------------------------------------
async function matchGuestToListings(guest) {
  const listingsResult = await pool.query(
    `SELECT l.*, u.personality_tags as host_tags, u.city as host_city
     FROM listings l
     JOIN users u ON l.host_id = u.id
     WHERE l.is_active = true`
  );
  const listings = listingsResult.rows;

  for (const listing of listings) {
    const score = calculateScore(guest, listing);
    await pool.query(
      `INSERT INTO matches (listing_id, host_id, guest_id, compatibility_score, score_breakdown)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (listing_id, guest_id)
       DO UPDATE SET compatibility_score = EXCLUDED.compatibility_score,
                     score_breakdown = EXCLUDED.score_breakdown,
                     updated_at = NOW()`,
      [listing.id, listing.host_id, guest.id, score.total, JSON.stringify(score.breakdown)]
    );
  }
  console.log(`Generated ${listings.length} matches for guest ${guest.id}`);
}

// -----------------------------------------------------------------------
// matchHostListingsToGuests
// -----------------------------------------------------------------------
async function matchHostListingsToGuests(host) {
  const listingsResult = await pool.query(
    'SELECT * FROM listings WHERE host_id = $1 AND is_active = true',
    [host.id]
  );
  const guestsResult = await pool.query(
    'SELECT * FROM users WHERE role = $1 AND onboarding_complete = true',
    ['guest']
  );

  for (const listing of listingsResult.rows) {
    for (const guest of guestsResult.rows) {
      const score = calculateScore(guest, listing);
      await pool.query(
        `INSERT INTO matches (listing_id, host_id, guest_id, compatibility_score, score_breakdown)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (listing_id, guest_id)
         DO UPDATE SET compatibility_score = EXCLUDED.compatibility_score,
                       score_breakdown = EXCLUDED.score_breakdown,
                       updated_at = NOW()`,
        [listing.id, host.id, guest.id, score.total, JSON.stringify(score.breakdown)]
      );
    }
  }
}

// -----------------------------------------------------------------------
// findMatches — called from matches.js route
// Returns scored matches for a user (for manual regeneration)
// -----------------------------------------------------------------------
async function findMatches(user, poolParam) {
  const db = poolParam || pool;
  if (user.role === 'guest') {
    await matchGuestToListings(user);
  } else {
    await matchHostListingsToGuests(user);
  }

  const result = await db.query(
    'SELECT * FROM matches WHERE guest_id = $1 OR host_id = $1 ORDER BY compatibility_score DESC',
    [user.id]
  );
  return result.rows;
}

// -----------------------------------------------------------------------
// calculateScore — core scoring algorithm
// -----------------------------------------------------------------------
function calculateScore(guest, listing) {
  const breakdown = {
    budget: scoreBudget(guest, listing),
    lifestyle: scoreLifestyle(guest, listing),
    location: scoreLocation(guest, listing),
    rules: scoreRules(guest, listing),
  };

  const total = Math.round(
    (breakdown.budget * WEIGHTS.budget +
      breakdown.lifestyle * WEIGHTS.lifestyle +
      breakdown.location * WEIGHTS.location +
      breakdown.rules * WEIGHTS.rules) / 100
  );

  return { total, breakdown };
}

function scoreBudget(guest, listing) {
  const maxBudget = guest.budget_max || 0;  // cents
  const rent = listing.monthly_rent_cents;  // cents

  if (maxBudget === 0) return 50;

  if (rent <= maxBudget) {
    const ratio = rent / maxBudget;
    return Math.round(70 + (1 - ratio) * 30);
  } else {
    const overBy = (rent - maxBudget) / maxBudget;
    if (overBy > 0.3) return 0;
    return Math.round(70 * (1 - overBy / 0.3));
  }
}

function scoreLifestyle(guest, listing) {
  const guestTags = new Set(guest.personality_tags || []);
  const hostTags = new Set(listing.host_tags || []);

  const guestWantsHelper = guestTags.has('open-to-helper');
  const hostWantsHelper = listing.helper_exchange_available;
  const helperMatch = (guestWantsHelper && hostWantsHelper) ? 20
    : (!guestWantsHelper && !hostWantsHelper) ? 10 : -10;

  let sharedCount = 0;
  for (const tag of guestTags) {
    if (hostTags.has(tag)) sharedCount++;
  }
  const sharedBonus = Math.min(sharedCount * 10, 30);

  return Math.min(Math.max(50 + helperMatch + sharedBonus, 0), 100);
}

function scoreLocation(guest, listing) {
  const guestCity = (guest.city || '').toLowerCase();
  const listingCity = (listing.city || '').toLowerCase();

  if (!guestCity) return 60;
  if (listingCity.includes(guestCity) || guestCity.includes(listingCity)) return 100;

  const guestState = (guest.state || '').toLowerCase();
  const listingState = (listing.state || '').toLowerCase();
  if (guestState && guestState === listingState) return 70;

  return 20;
}

function scoreRules(guest, listing) {
  const guestTags = guest.personality_tags || [];
  let score = 80;

  if (!listing.pets_allowed && guestTags.includes('has-pets')) score -= 60;
  if (!listing.smoking_allowed && guestTags.includes('smoker')) score -= 60;

  return Math.max(score, 0);
}

module.exports = {
  generateMatchesForUser,
  matchGuestToListings,
  matchHostListingsToGuests,
  findMatches,
  calculateScore,
};
