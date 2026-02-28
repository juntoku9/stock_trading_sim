import React from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env.local');
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ClerkProvider publishableKey={publishableKey}>
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
