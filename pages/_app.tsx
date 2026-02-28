import type { AppProps } from 'next/app';
import Head from 'next/head';
import Script from 'next/script';
import { ClerkProvider } from '@clerk/clerk-react';
import '../styles/globals.css';

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function NextApp({ Component, pageProps }: AppProps) {
  if (!publishableKey) {
    throw new Error('Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in .env.local');
  }

  return (
    <>
      <Head>
        <title>PaperTrade Pro | Terminal Edition</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='8' fill='%23000'/%3E%3Cpath d='M14 42 L26 30 L34 36 L50 20' stroke='%23facc15' stroke-width='6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
      <ClerkProvider publishableKey={publishableKey}>
        <Component {...pageProps} />
      </ClerkProvider>
    </>
  );
}
