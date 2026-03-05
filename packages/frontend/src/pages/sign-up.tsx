import { SignUp } from '@clerk/clerk-react';
import type { ReactElement } from 'react';
import { AuthCentreLayout } from '../components/auth/auth-centre-layout';
import { clerkAppearance } from '../lib/clerk-theme';

/**
 * Sign-up page. Renders Clerk's SignUp component within the MMF auth layout.
 */
export default function SignUpPage(): ReactElement {
  return (
    <AuthCentreLayout>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl="/onboarding"
        appearance={clerkAppearance}
      />
    </AuthCentreLayout>
  );
}
