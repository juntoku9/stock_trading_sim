<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1IlUysw9kK-4_jF8QDobU_xcUTuj29h6L

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set `VITE_CLERK_PUBLISHABLE_KEY` in `.env.local` for login
3. Set the `GEMINI_API_KEY` in `.env.local` if you want the AI assistant enabled
4. Stock quotes are served through a local Yahoo Finance proxy powered by `yahoo-finance2`, so no separate stock API key is required
5. Run the app:
   `npm run dev`
