import { type ReactElement } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './routes';

/**
 * App — router setup.
 * ClerkProvider and QueryClientProvider are set up in main.tsx.
 */
export function App(): ReactElement {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}




























