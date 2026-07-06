import type { AppProps } from 'next/app';
import Head from 'next/head';
import { ClerkProvider } from '@clerk/nextjs';
// Tailwind is now compiled at build time via PostCSS (see tailwind.config.mjs).
// The previous cdn.tailwindcss.com <Script> ran the ~300KB JIT compiler in the
// browser on every load — explicitly not for production use.
import '../styles/globals.css';

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const MissingEnvironmentScreen = () => (
  <main className="min-h-screen bg-[#0a0a0a] text-[#ededed] flex items-center justify-center px-6">
    <section className="max-w-2xl border border-white/[0.08] bg-[#161616] rounded-xl p-8">
      <p className="text-sm font-semibold text-green-400 mb-3">PaperTrade Pro setup required</p>
      <h1 className="text-3xl font-semibold tracking-tight mb-4">Add your local environment variables</h1>
      <p className="text-sm leading-6 text-[#a1a1aa] mb-6">
        Copy <code className="text-white">.env.example</code> to <code className="text-white">.env.local</code>,
        then add your Clerk publishable key, Clerk secret key, and database URL.
      </p>
      <pre className="overflow-x-auto rounded-lg bg-[#0a0a0a] border border-white/[0.08] p-4 text-sm text-[#d4d4d8]">
        <code>cp .env.example .env.local</code>
      </pre>
    </section>
  </main>
);

const AppShell = ({ Component, pageProps }: AppProps) => (
  <>
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
    <Component {...pageProps} />
  </>
);

const PaperTradeApp = (props: AppProps) => {
  if (!clerkPublishableKey) {
    return (
      <>
        <Head>
          <title>PaperTrade Pro Setup</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <MissingEnvironmentScreen />
      </>
    );
  }

  return (
    <ClerkProvider {...props.pageProps} publishableKey={clerkPublishableKey}>
      <AppShell {...props} />
    </ClerkProvider>
  );
};

export default PaperTradeApp;
