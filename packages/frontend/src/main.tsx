import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initApiClient } from './api/client';
import { App } from './App';
import './index.css';

const PUBLISHABLE_KEY = import.meta.env['VITE_CLERK_PUBLISHABLE_KEY'] as string | undefined;

if (!PUBLISHABLE_KEY) {
  throw new Error('VITE_CLERK_PUBLISHABLE_KEY is required. Add it to your .env file.');
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      retry: 1,
    },
  },
});

/**
 * ApiClientInitialiser — mounts inside ClerkProvider to access useAuth.
 * Initialises the global API client with the Clerk token getter.
 */
function ApiClientInitialiser(): null {
  const { getToken } = useAuth();
  initApiClient(getToken);
  return null;
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found. Ensure index.html has <div id="root"></div>.');
}

createRoot(rootElement).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <QueryClientProvider client={queryClient}>
        <ApiClientInitialiser />
        <App />
      </QueryClientProvider>
    </ClerkProvider>
  </StrictMode>,
);




























