import { type ReactElement } from 'react';
import './App.css';
import { PageShell } from './components/layout/page-shell';
import { LandingPlaceholder } from './components/layout/landing-placeholder';

export function App(): ReactElement {
  return (
    <PageShell>
      <LandingPlaceholder />
    </PageShell>
  );
}
