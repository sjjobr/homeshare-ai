/**
 * tavusService.js
 * Wrapper for the Tavus Conversational Video Intelligence (CVI) API.
 * Docs: https://docs.tavus.io
 */

const axios = require('axios');

const TAVUS_API_BASE = 'https://tavusapi.com/v2';
const TAVUS_API_KEY  = process.env.TAVUS_API_KEY;
const PERSONA_ID     = process.env.TAVUS_PERSONA_ID;
const REPLICA_ID     = process.env.TAVUS_REPLICA_ID;

const tavusApi = axios.create({
  baseURL: TAVUS_API_BASE,
  headers: {
    'x-api-key': TAVUS_API_KEY,
    'Content-Type': 'application/json',
  },
});

// -----------------------------------------------------------------------
// createConversation
// Starts a new CVI conversation for a user during onboarding.
// Returns: { conversation_id, conversation_url }
// -----------------------------------------------------------------------
async function createConversation({ userId, role, userName, webhookUrl }) {
  const conversationName = role === 'host'
    ? 'HomeShare Host Onboarding'
    : 'HomeShare Guest Onboarding';

  const systemPrompt = buildSystemPrompt(role, userName);

  // Encode user_id as a query param on the webhook URL so it comes back
  // with the webhook payload (Tavus no longer accepts a webhook_user_id field).
  const base = webhookUrl || process.env.TAVUS_WEBHOOK_URL;
  const callbackUrl = base ? `${base}?user_id=${encodeURIComponent(userId)}` : undefined;

  const payload = {
    replica_id: REPLICA_ID,
    persona_id: PERSONA_ID,
    conversation_name: conversationName,
    conversational_context: systemPrompt,
    custom_greeting: buildGreeting(role, userName),
    properties: {
      max_call_duration: 600,        // 10 minutes max
      participant_left_timeout: 30,
      enable_recording: false,
    },
    ...(callbackUrl ? { callback_url: callbackUrl } : {}),
  };

  const response = await tavusApi.post('/conversations', payload);
  return {
    conversationId:  response.data.conversation_id,
    conversationUrl: response.data.conversation_url,
    status:          response.data.status,
  };
}

// -----------------------------------------------------------------------
// endConversation
// Gracefully ends an active conversation.
// -----------------------------------------------------------------------
async function endConversation(conversationId) {
  await tavusApi.delete(`/conversations/${conversationId}`);
}

// -----------------------------------------------------------------------
// getConversation
// Fetches the current status and transcript of a conversation.
// -----------------------------------------------------------------------
async function getConversation(conversationId) {
  const response = await tavusApi.get(`/conversations/${conversationId}`);
  return response.data;
}

// -----------------------------------------------------------------------
// parseWebhookPayload
// Called from the /api/tavus/webhook route.
// Extracts structured profile data from the Tavus transcript.
// -----------------------------------------------------------------------
function parseWebhookPayload(payload) {
  const transcript = payload.transcript || payload.full_conversation || '';
  const userId     = payload.webhook_user_id || payload.properties?.webhook_user_id;

  // Extract key data fields from the AI conversation
  const extractedData = extractProfileData(transcript, payload.properties?.conversation_name || '');

  return {
    userId,
    conversationId: payload.conversation_id,
    status:         payload.status || 'ended',
    transcript,
    extractedData,
  };
}

// -----------------------------------------------------------------------
// extractProfileData
// Heuristic extraction of structured profile data from transcript text.
// In production you'd call an LLM (e.g. GPT-4o) to do structured extraction.
// -----------------------------------------------------------------------
function extractProfileData(transcript, conversationName) {
  const isHost = conversationName.toLowerCase().includes('host');

  const data = {
    role: isHost ? 'host' : 'guest',
    budget: null,           // monthly rent in dollars
    location: null,         // city / neighborhood
    lifestyle: {},          // personality attributes
    helperExchange: false,  // open to chore-for-rent exchange
    houseRules: [],
    bio: '',
  };

  // Very simple keyword extraction — replace with LLM call in production
  const lowerTranscript = transcript.toLowerCase();

  // Budget extraction (look for dollar amounts)
  const budgetMatch = transcript.match(/\$(\d[,\d]*)/);
  if (budgetMatch) {
    data.budget = parseInt(budgetMatch[1].replace(',', ''), 10);
  }

  // Helper exchange
  if (lowerTranscript.includes('helper') || lowerTranscript.includes('chore') || lowerTranscript.includes('help around')) {
    data.helperExchange = true;
  }

  // Lifestyle attributes
  if (lowerTranscript.includes('quiet')) data.lifestyle.quiet = true;
  if (lowerTranscript.includes('social') || lowerTranscript.includes('friendly')) data.lifestyle.social = true;
  if (lowerTranscript.includes('pet') || lowerTranscript.includes('dog') || lowerTranscript.includes('cat')) {
    data.lifestyle.hasPets = true;
  }
  if (lowerTranscript.includes('non-smok') || lowerTranscript.includes('no smoking')) {
    data.houseRules.push('no smoking');
  }
  if (lowerTranscript.includes('early') || lowerTranscript.includes('morning person')) {
    data.lifestyle.earlyRiser = true;
  }

  // Bio: use a segment of the transcript as a summary
  if (transcript.length > 100) {
    data.bio = transcript.substring(0, 300).trim() + '...';
  }

  return data;
}

// -----------------------------------------------------------------------
// buildSystemPrompt
// Instructions given to the Tavus AI persona.
// -----------------------------------------------------------------------
function buildSystemPrompt(role, userName) {
  const sharedRules = `
CRITICAL CONVERSATION RULES — follow these strictly:
- Ask each topic ONCE. Never re-ask a topic the user has already addressed, even partially.
- If their answer was vague, accept it and move on. Do NOT probe for more detail unless they invite it.
- After every answer, give a brief one-sentence acknowledgement (e.g. "Got it.", "Wonderful.", "Makes sense."), then move directly to the NEXT topic in the list. Never circle back.
- Keep YOUR turns short — one or two sentences. Let them do most of the talking.
- Internally track which topics you have covered. Before asking, silently check: "have I already touched this?" If yes, skip it.
- When all topics are covered, give a warm closing line and stop. Do not invent extra topics.
- Never repeat a question you've already asked, even in different words.
- If the user goes off-topic, gently acknowledge and steer back to the next unasked topic.
`.trim();

  if (role === 'host') {
    return `You are Haven, a warm AI guide for HomeShare — a platform that helps older adults share their home with trustworthy renters. You are interviewing ${userName}, who wants to list a room.

${sharedRules}

COVER THESE TOPICS, IN ORDER, EXACTLY ONCE EACH:
1. A short description of their home and the room they're offering
2. The monthly rent they have in mind (a number or range is fine)
3. Whether they prefer a quiet household or a more social one
4. Whether they're open to a helper arrangement (tenant helps with chores in exchange for reduced rent) — yes/no is enough
5. Any house rules (pets, smoking, guests, noise) — accept "none" as an answer
6. The kind of person they're hoping to find

Closing: thank them warmly, tell them their profile is being set up, and end the call.`;
  }

  return `You are Haven, a warm AI guide for HomeShare — a platform that helps people find affordable home-sharing arrangements with considerate older homeowners. You are interviewing ${userName}, who is looking for a room.

${sharedRules}

COVER THESE TOPICS, IN ORDER, EXACTLY ONCE EACH:
1. A short introduction — who they are and their current situation
2. Their monthly budget for rent (a number or range is fine)
3. The area or neighborhood they're looking in
4. Their daily routine — are they home a lot, or mostly out?
5. Whether they'd be interested in a helper arrangement (chores in exchange for reduced rent) — yes/no is enough
6. What they need from a home to feel comfortable

Closing: thank them, tell them their profile is being created, and end the call.`;
}

// -----------------------------------------------------------------------
// buildGreeting
// -----------------------------------------------------------------------
function buildGreeting(role, userName) {
  const firstName = userName.split(' ')[0];
  if (role === 'host') {
    return `Hi ${firstName}! I'm Haven, and I'm so glad you're here. I'd love to help you share your home with someone wonderful. I'm going to ask you a few friendly questions to set up your listing — there are no wrong answers, so just speak naturally. Ready to get started?`;
  }
  return `Hi ${firstName}! I'm Haven. Welcome to HomeShare! I'm going to ask you a few friendly questions so we can find the perfect home for you. Just answer naturally — this is just a conversation, not a test. Ready when you are!`;
}

module.exports = {
  createConversation,
  endConversation,
  getConversation,
  parseWebhookPayload,
};
