-- HomeShare AI Database Schema
-- PostgreSQL 15+

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT,
  role VARCHAR(20) NOT NULL CHECK (role IN ('host', 'guest', 'admin')),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(30),
  date_of_birth DATE,
  avatar_url TEXT,
  bio TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  zip_code VARCHAR(20),
  verified BOOLEAN DEFAULT FALSE,

  -- Guest preference fields (populated by Tavus AI)
  budget_min INTEGER,             -- monthly rent min in cents
  budget_max INTEGER,             -- monthly rent max in cents
  move_in_date DATE,
  lifestyle_preferences JSONB,    -- e.g. {morning_person: 8, social: 3}
  helper_exchange BOOLEAN DEFAULT FALSE,

  -- Tavus onboarding
  tavus_conversation_id TEXT,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  personality_tags TEXT[],        -- e.g. ['quiet', 'tidy', 'social']

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LISTINGS (Rooms posted by Hosts)
-- ============================================================
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  zip_code VARCHAR(20) NOT NULL,
  country VARCHAR(100) DEFAULT 'US',
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  region VARCHAR(100),

  monthly_rent_cents INTEGER NOT NULL,    -- rent in cents
  deposit_cents INTEGER,                  -- deposit in cents
  room_type VARCHAR(50),                  -- 'private', 'shared', 'suite'
  total_rooms INTEGER DEFAULT 1,
  bathroom_type VARCHAR(50),              -- 'private', 'shared'
  square_footage INTEGER,
  is_furnished BOOLEAN DEFAULT TRUE,
  utilities_included BOOLEAN DEFAULT TRUE,
  pets_allowed BOOLEAN DEFAULT FALSE,
  smoking_allowed BOOLEAN DEFAULT FALSE,
  min_stay_months INTEGER DEFAULT 1,
  max_stay_months INTEGER,

  helper_exchange_available BOOLEAN DEFAULT FALSE,
  helper_exchange_details TEXT,
  helper_discount_cents INTEGER DEFAULT 0,

  amenities TEXT[],                       -- ['wifi', 'parking', 'laundry']
  photos TEXT[],                          -- array of URLs
  is_active BOOLEAN DEFAULT TRUE,
  available_from DATE,
  available_to DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MATCHES
-- ============================================================
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  compatibility_score INTEGER NOT NULL DEFAULT 0,   -- 0-100
  score_breakdown JSONB,

  host_status VARCHAR(20) DEFAULT 'pending' CHECK (host_status IN ('pending','liked','passed')),
  guest_status VARCHAR(20) DEFAULT 'pending' CHECK (guest_status IN ('pending','liked','passed')),
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending','liked','passed','connected','rejected')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(listing_id, guest_id)
);

-- ============================================================
-- APPOINTMENTS
-- ============================================================
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id),
  host_id UUID NOT NULL REFERENCES users(id),
  guest_id UUID NOT NULL REFERENCES users(id),

  type VARCHAR(20) NOT NULL CHECK (type IN ('video_call', 'in_person')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_mins INTEGER DEFAULT 30,
  location TEXT,
  notes TEXT,

  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','cancelled','completed','no_show')),

  cancelled_by UUID REFERENCES users(id),
  cancel_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TAVUS CONVERSATIONS
-- ============================================================
CREATE TABLE tavus_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tavus_conversation_id TEXT UNIQUE NOT NULL,
  persona_id TEXT,
  replica_id TEXT,
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active','ended','failed')),
  extracted_data JSONB,
  raw_transcript TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_listings_host_id ON listings(host_id);
CREATE INDEX idx_listings_is_active ON listings(is_active);
CREATE INDEX idx_listings_city ON listings(city);
CREATE INDEX idx_listings_rent ON listings(monthly_rent_cents);
CREATE INDEX idx_matches_listing ON matches(listing_id);
CREATE INDEX idx_matches_guest ON matches(guest_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_appointments_match ON appointments(match_id);
CREATE INDEX idx_appointments_time ON appointments(scheduled_at);
CREATE INDEX idx_messages_match ON messages(match_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_listings
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_matches
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_appointments
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
