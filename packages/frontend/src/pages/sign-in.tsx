import { SignIn } from '@clerk/clerk-react';
import type { ReactElement } from 'react';
import { AuthCentreLayout } from '../components/auth/auth-centre-layout';
import { clerkAppearance } from '../lib/clerk-theme';

/**
 * Sign-in page. Renders Clerk's SignIn component within the MMF auth layout.
 */
export default function SignInPage(): ReactElement {
  return (
    <AuthCentreLayout>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl="/dashboard"
        appearance={clerkAppearance}
      />
    </AuthCentreLayout>
  );
}
