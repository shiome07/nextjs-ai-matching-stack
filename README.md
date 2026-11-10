Next.js AI Matching Stack
A reference implementation for building a two-sided matching platform. It pairs semantic vector search for matching with a strict server-side image moderation pipeline.

It was originally built to explore an alternative approach to dating apps, but the architecture is generic enough for roommates, mentorship, or any app that needs to match two users and verify user-generated content.

How it works
Most matching apps rely on opaque algorithms or simple filters. This stack does the following:

Semantic Matching. Uses pgvector and OpenAI embeddings to match users based on the meaning of their bios rather than just hard filters.

Direct-to-bucket uploads. The client uploads profile photos directly to Cloudflare R2 using presigned URLs. The Next.js server never handles the raw image bytes.

Strict moderation. Before a photo can be displayed, a background job fetches it from R2 and runs it through OpenAI Moderation and Arachnid Shield (CSAM detection).

Conversation unlocks. Includes a schema and API routes for a token-based paywall, allowing you to gate messaging behind a one-time fee instead of a recurring subscription.

Stack
Framework: Next.js 16 (App Router, Turbopack). Uses the new proxy.ts middleware convention.

Auth: Clerk v7. Handles sessions and syncs new users to the database via webhooks.

Database: Neon Postgres with the pgvector extension.

Storage: Cloudflare R2.

Safety APIs: OpenAI (omni-moderation-latest) and Arachnid Shield. Optional KYC via Didit.

Setup
bash
git clone https://github.com/shiome07/nextjs-ai-matching-stack.git
cd nextjs-ai-matching-stack
npm install
cp .env.example .env.local
Fill in the variables in .env.local. You need Clerk, Neon, and R2 to boot the app. The moderation keys are optional until you hit those routes.

bash
npm run dev
The app runs at http://localhost:3000.

Database
Neon needs the pgvector extension enabled. Run this in the Neon SQL editor:

sql
CREATE EXTENSION IF NOT EXISTS vector;
The app expects the schema to be applied. Core tables include users, profiles, profile_photos, user_preferences, swipes, matches, messages, and transactions.

The moderation pipeline
The flow for handling images is split into three steps to keep untrusted files off the app server:

/api/photos/presign generates a time-limited PUT URL. The client uploads the file to R2.

/api/photos/verify fetches the image back from R2 and sends it to OpenAI Moderation and Arachnid Shield.

If both pass, the database row is marked approved, and the client gets a presigned GET URL to display it. If either fails, the photo remains hidden.

What this is not
Not a finished product. This is a reference implementation. You are responsible for payments, hosting, scaling, and compliance.

Not a mobile app. It is a responsive web app built with Tailwind and shadcn/ui. There is no React Native wrapper.

Not a complex recommendation engine. The matching logic is straightforward cosine similarity on text embeddings. It works well for small user bases, but it is not a machine learning pipeline.

