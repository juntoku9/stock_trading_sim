<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy PaperTrade Pro

This project is now a Next.js app with server-side API routes for quotes, paper trading, and leaderboard persistence.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in `.env.local` for login
3. Set `DATABASE_URL` in `.env.local` for Neon-backed portfolio and trade persistence
4. Set `GEMINI_API_KEY` in `.env.local` if you want the AI assistant enabled
5. Stock quotes are served through Next API routes powered by `yahoo-finance2`, so no separate stock API key is required
6. Run the app:
   `npm run dev`
