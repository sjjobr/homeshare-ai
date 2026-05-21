# HomeShare AI

An intergenerational home-sharing platform for older adults with extra rooms, powered by a Tavus AI video agent for onboarding, matching, and appointment scheduling.

## Overview

HomeShare AI connects older homeowners (Hosts) who have spare rooms with trustworthy renters (Guests) seeking affordable, flexible housing. Instead of filling out cold forms, users have a face-to-face AI video conversation with a friendly Tavus-powered agent who collects their info, understands their personality, and schedules viewings.

### Key Features

- Tavus AI Video Agent Onboarding: hosts and guests complete their profile through a conversational video interview
- Smart Matching: algorithm matches on lifestyle, budget, schedule, and compatibility scores
- Appointment Booking: integrated calendar for scheduling viewings and meet-and-greets
- Verified Listings: room listings with photos, amenities, rules, and AI-extracted personality tags
- Secure Messaging: in-app chat with identity kept private until both parties confirm interest
- Lease and Payment: digital lease signing and recurring payment processing
- Host Helper Exchange: guests provide household help for reduced rent

## Project Structure

frontend/ (React + Vite + TailwindCSS)
  src/
    pages/
      LandingPage.jsx
      OnboardingPage.jsx       <- Tavus AI agent embedded here
      ListingsPage.jsx
      ListingDetail.jsx
      MatchesPage.jsx
      MessagesPage.jsx
      AppointmentsPage.jsx
      Dashboard.jsx
    components/
      TavusVideoAgent.jsx      <- Embeds Tavus CVI iframe
      ListingCard.jsx
      MatchCard.jsx
      AppointmentCalendar.jsx
      ChatWindow.jsx
      Navbar.jsx
    hooks/
      useTavusConversation.js
      useAuth.js
    store/appStore.js          <- Zustand global state
backend/ (Node.js + Express + PostgreSQL)
  src/
    routes/
      auth.js
      listings.js
      matches.js
      appointments.js
      messages.js
      tavus.js                 <- Tavus webhook handler
    services/
      tavusService.js
      matchingService.js
      emailService.js
    models/
      User.js
      Listing.js
      Match.js
      Appointment.js
    db/schema.sql
docker-compose.yml

## Quick Start

Clone and install:
  git clone https://github.com/YOUR_USERNAME/homeshare-ai.git
  cd homeshare-ai
  cd backend && npm install
  cd ../frontend && npm install

Copy env files:
  cp backend/.env.example backend/.env
  cp frontend/.env.example frontend/.env

Setup database:
  psql -U postgres -c "CREATE DATABASE homeshare;"
  psql -U postgres -d homeshare -f backend/src/db/schema.sql

Run dev servers:
  Terminal 1: cd backend && npm run dev
  Terminal 2: cd frontend && npm run dev

Or with Docker: docker-compose up --build

## Tavus AI Agent Integration

The platform uses Tavus Conversational Video Intelligence (CVI) for live AI video interviews during onboarding.

### Flow

1. User registers and selects Host or Guest role
2. Tavus conversation launches in-browser
3. AI avatar "Haven" asks onboarding questions about lifestyle and preferences
4. Responses are transcribed and structured data is posted to /api/tavus/webhook
5. Profile is auto-populated, user reviews and confirms
6. Matching algorithm runs automatically
7. Haven can also schedule viewing appointments by voice

### Tavus Setup

1. Create a Persona in the Tavus dashboard (name it "Haven")
2. Create a Replica (AI video avatar)
3. Set Webhook URL: https://your-domain.com/api/tavus/webhook
4. Add TAVUS_API_KEY to backend/.env
5. Add VITE_TAVUS_PERSONA_ID to frontend/.env

### Onboarding Questions for Hosts
- Tell me about your home and the room you would like to share
- What is your preferred monthly rent range?
- Do you prefer a quiet household or a social environment?
- Are you open to a helper arrangement (reduced rent for chores)?
- What are your house rules around pets, smoking, and guests?
- What kind of person would be a great fit for your home?

### Onboarding Questions for Guests
- Tell me a bit about yourself and your situation
- What is your monthly budget?
- What neighborhood or area are you looking in?
- Describe your daily routine
- Are you interested in a helper arrangement?
- What do you need from a home environment to feel comfortable?

## API Reference

POST  /api/auth/register          Create account
POST  /api/auth/login             Login, get JWT
GET   /api/listings               Browse listings (filter: region, budget)
POST  /api/listings               Create listing (Host only)
GET   /api/listings/:id           Single listing detail
GET   /api/matches                Get my matches with scores
POST  /api/matches/:id/like       Express interest in match
GET   /api/appointments           List my appointments
POST  /api/appointments           Book a viewing appointment
POST  /api/tavus/conversation     Start CVI conversation
POST  /api/tavus/webhook          Receive transcript and extracted data
GET   /api/messages/:matchId      Get conversation history
POST  /api/messages/:matchId      Send message

## Tech Stack

Frontend:  React 18, Vite, TailwindCSS, React Router v6, Zustand
Backend:   Node.js 18, Express 4, JWT authentication
Database:  PostgreSQL 15 + Prisma ORM
AI Video:  Tavus CVI API (Phoenix model)
Storage:   AWS S3 (room photos)
Payments:  Stripe
Email:     Resend
Deploy:    Docker, Railway or Render

## Environment Variables

backend/.env.example:
  DATABASE_URL=postgresql://postgres:password@localhost:5432/homeshare
  JWT_SECRET=your-super-secret-jwt-key
  PORT=4000
  TAVUS_API_KEY=tvs-xxxxxxxxxxxx
  TAVUS_PERSONA_ID=p-xxxxxxxxxx
  TAVUS_REPLICA_ID=r-xxxxxxxxxx
  TAVUS_WEBHOOK_SECRET=your-webhook-secret
  AWS_ACCESS_KEY_ID=
  AWS_SECRET_ACCESS_KEY=
  AWS_S3_BUCKET=homeshare-photos
  AWS_REGION=us-east-1
  STRIPE_SECRET_KEY=sk_test_
  STRIPE_WEBHOOK_SECRET=whsec_
  RESEND_API_KEY=re_
  FROM_EMAIL=hello@homeshare.ai

frontend/.env.example:
  VITE_API_URL=http://localhost:4000
  VITE_TAVUS_PERSONA_ID=p-xxxxxxxxxx
  VITE_STRIPE_PUBLISHABLE_KEY=pk_test_

## Roadmap

- [x] Project scaffold and architecture
- [x] Tavus CVI integration (onboarding flow)
- [x] Host and Guest profile system
- [x] Room listings CRUD
- [x] Compatibility matching algorithm
- [x] Appointment booking calendar
- [x] In-app messaging
- [ ] Digital lease signing (DocuSign)
- [ ] Stripe payment integration
- [ ] Mobile app (React Native)
- [ ] Background check integration (Checkr)
- [ ] Community features

## License

MIT License. Built with love for older adults who deserve great company.
