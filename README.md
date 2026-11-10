# Next.js AI Matching Stack

A reference implementation for building a two-sided matching platform. It pairs semantic vector search for matching with a strict server-side image moderation pipeline. 

It was originally built to explore an alternative approach to dating apps, but the architecture is generic enough for roommates, mentorship, or any app that needs to match two users and verify user-generated content.

## How it works

Most matching apps rely on opaque algorithms or simple filters. This stack does the following:

- **Semantic Matching.** Uses `pgvector` and OpenAI embeddings to match users based on the meaning of their bios rather than just hard filters.
- **Direct-to-bucket uploads.** The client uploads profile photos directly to Cloudflare R2 using presigned URLs. The Next.js server never handles the raw image bytes.
- **Strict moderation.** Before a photo can be displayed, a background job fetches it from R2 and runs it through OpenAI Moderation and Arachnid Shield (CSAM detection).
- **Conversation unlocks.** Includes a schema and API routes for a token-based paywall, allowing you to gate messaging behind a one-time fee instead of a recurring subscription.

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack). Uses the new `proxy.ts` middleware convention.
- **Auth:** Clerk v7. Handles sessions and syncs new users to the database via webhooks.
- **Database:** Neon Postgres with the `pgvector` extension.
- **Storage:** Cloudflare R2.
- **Safety APIs:** OpenAI (`omni-moderation-latest`) and Arachnid Shield. Optional KYC via Didit.

## Setup

```bash
git clone https://github.com/shiome07/nextjs-ai-matching-stack.git
cd nextjs-ai-matching-stack
npm install
cp .env.example .env.local