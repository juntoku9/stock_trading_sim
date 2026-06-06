import type { AppProps } from 'next/app';
import Head from 'next/head';
import Script from 'next/script';
import { ClerkProvider } from '@clerk/nextjs';
import '../styles/globals.css';

const PaperTradeApp = ({ Component, pageProps }: AppProps) => (
  <ClerkProvider {...pageProps}>
    <Head>
      <title>PaperTrade Pro</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <link
        rel="icon"
        href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23161616'/%3E%3Cpath d='M14 42 L26 30 L34 36 L50 20' stroke='%2322c55e' stroke-width='6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"
      />
    </Head>
    <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
    <Component {...pageProps} />
  </ClerkProvider>
);

export default PaperTradeApp;
