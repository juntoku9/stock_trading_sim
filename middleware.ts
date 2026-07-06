import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

/**
 * All /api routes require a signed-in Clerk session:
 * - trading routes derive their identity from it (no more spoofable headers)
 * - quote/search/history/news/assistant routes stop being anonymous cost sinks
 *   (each news/assistant hit is a paid OpenAI/Gemini call).
 */
const isApiRoute = createRouteMatcher(['/api(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isApiRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
});

export const config = {
  matcher: [
    // Run on everything except static assets, so getAuth() works in API routes.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
