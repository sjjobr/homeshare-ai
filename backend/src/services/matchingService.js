/**
 * matchingService.js
 * Compatibility scoring between Hosts and Guests.
 * Generates and updates match records in the database.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Weights for each compatibility dimension (must sum to 100)
const WEIGHTS = {
  budget:    30,   // Guest budget vs listing rent
  lifestyle: 35,   // Lifestyle / personality alignment
  location:  15,   // City / region match
  rules:     20,   // House rule compatibility
};

// -----------------------------------------------------------------------
// generateMatchesForUser
// Called after a user completes onboarding.
// Creates match records with compatibility scores.
// -----------------------------------------------------------------------
async function generateMatchesForUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { guestPreference: true },
  });

  if (!user || !user.onboardingCompleted) return;

  if (user.role === 'guest') {
    await matchGuestToListings(user);
  } else if (user.role === 'host') {
    await matchHostListingsToGuests(user);
  }
}

// -----------------------------------------------------------------------
// matchGuestToListings
// For a guest, score every active listing and create/update match records.
// -----------------------------------------------------------------------
async function matchGuestToListings(guest) {
  const listings = await prisma.listing.findMany({
    where:   { status: 'active' },
    include: { host: true },
  });

  const matchData = listings.map((listing) => {
    const score = calculateScore(guest, listing);
    return {
      listingId:          listing.id,
      hostId:             listing.hostId,
      guestId:            guest.id,
      compatibilityScore: score.total,
      scoreBreakdown:     score.breakdown,
    };
  });

  // Upsert match records (update if already exists)
  for (const match of matchData) {
    await prisma.match.upsert({
      where: {
        listingId_guestId: {
          listingId: match.listingId,
          guestId:   match.guestId,
        },
      },
      update: {
        compatibilityScore: match.compatibilityScore,
        scoreBreakdown:     match.scoreBreakdown,
      },
      create: match,
    });
  }

  console.log(`Generated ${matchData.length} matches for guest ${guest.id}`);
}

// -----------------------------------------------------------------------
// matchHostListingsToGuests
// When a host completes onboarding or updates a listing,
// score all eligible guests against their listings.
// -----------------------------------------------------------------------
async function matchHostListingsToGuests(host) {
  const listings = await prisma.listing.findMany({
    where: { hostId: host.id, status: 'active' },
  });

  const guests = await prisma.user.findMany({
    where:   { role: 'guest', onboardingCompleted: true },
    include: { guestPreference: true },
  });

  for (const listing of listings) {
    for (const guest of guests) {
      const score = calculateScore(guest, listing);

      await prisma.match.upsert({
        where: {
          listingId_guestId: {
            listingId: listing.id,
            guestId:   guest.id,
          },
        },
        update: {
          compatibilityScore: score.total,
          scoreBreakdown:     score.breakdown,
        },
        create: {
          listingId:          listing.id,
          hostId:             host.id,
          guestId:            guest.id,
          compatibilityScore: score.total,
          scoreBreakdown:     score.breakdown,
        },
      });
    }
  }
}

// -----------------------------------------------------------------------
// calculateScore
// Core algorithm: returns { total: 0-100, breakdown: {...} }
// -----------------------------------------------------------------------
function calculateScore(guest, listing) {
  const breakdown = {
    budget:    scoreBudget(guest, listing),
    lifestyle: scoreLifestyle(guest, listing),
    location:  scoreLocation(guest, listing),
    rules:     scoreRules(guest, listing),
  };

  const total = Math.round(
    (breakdown.budget    * WEIGHTS.budget    +
     breakdown.lifestyle * WEIGHTS.lifestyle +
     breakdown.location  * WEIGHTS.location  +
     breakdown.rules     * WEIGHTS.rules
    ) / 100
  );

  return { total, breakdown };
}

// Budget score: how well does the guest's max budget align with the listing rent?
function scoreBudget(guest, listing) {
  const maxBudget = guest.guestPreference?.maxBudget || 0;  // cents
  const rent      = listing.monthlyRent;                    // cents

  if (maxBudget === 0) return 50; // No preference = neutral

  if (rent <= maxBudget) {
    // Well within budget: scale 70-100
    const ratio = rent / maxBudget;
    return Math.round(70 + (1 - ratio) * 30);
  } else {
    // Over budget: penalise
    const overBy = (rent - maxBudget) / maxBudget;
    if (overBy > 0.3) return 0;          // 30%+ over budget = 0
    return Math.round(70 * (1 - overBy / 0.3));
  }
}

// Lifestyle score: compare personality tags and lifestyle attributes
function scoreLifestyle(guest, listing) {
  const guestTags   = new Set(guest.personalityTags  || []);
  const hostTags    = new Set(listing.host?.personalityTags || []);

  // Helper exchange alignment
  const guestWantsHelper = guestTags.has('open-to-helper');
  const hostWantsHelper  = listing.helperExchange;
  const helperMatch = (guestWantsHelper && hostWantsHelper) ? 20 :
                      (!guestWantsHelper && !hostWantsHelper) ? 10 : -10;

  // Noise level alignment
  const guestQuiet = guestTags.has('quiet');
  const noSmokingMatch = (guestTags.has('no-smoking') && listing.houseRules?.includes('no smoking')) ? 10 : 0;

  // Shared tags bonus
  let sharedCount = 0;
  for (const tag of guestTags) {
    if (hostTags.has(tag)) sharedCount++;
  }
  const sharedBonus = Math.min(sharedCount * 10, 30);

  return Math.min(Math.max(50 + helperMatch + noSmokingMatch + sharedBonus, 0), 100);
}

// Location score: do they match on city or region?
function scoreLocation(guest, listing) {
  const guestCity   = (guest.lifestyleScore?.preferredCity   || '').toLowerCase();
  const guestRegion = (guest.lifestyleScore?.preferredRegion || '').toLowerCase();

  if (!guestCity && !guestRegion) return 60; // No preference = neutral

  const listingCity   = (listing.city   || '').toLowerCase();
  const listingRegion = (listing.region || '').toLowerCase();

  if (guestCity && listingCity.includes(guestCity))       return 100;
  if (guestRegion && listingRegion.includes(guestRegion)) return 80;
  return 20;
}

// Rules score: check for dealbreakers
function scoreRules(guest, listing) {
  const rules = listing.houseRules || [];
  let score = 80; // Start high

  if (rules.includes('no pets') && (guest.personalityTags || []).includes('has-pets')) {
    score -= 60; // Dealbreaker
  }
  if (rules.includes('no smoking') && (guest.personalityTags || []).includes('smoker')) {
    score -= 60;
  }
  if (listing.minStayMonths > (guest.lifestyleScore?.maxStayMonths || 24)) {
    score -= 30;
  }

  return Math.max(score, 0);
}

module.exports = {
  generateMatchesForUser,
  matchGuestToListings,
  matchHostListingsToGuests,
  calculateScore,
};
