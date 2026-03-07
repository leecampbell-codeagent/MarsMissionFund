import { SignIn } from '@clerk/react';
import { AuthPageLayout } from '../components/auth/AuthPageLayout';
import { clerkAppearance } from '../lib/clerkAppearance';

export default function SignInPage() {
  return (
    <AuthPageLayout subtitle="Fund the missions that get us there.">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/dashboard"
        appearance={clerkAppearance}
      />
    </AuthPageLayout>
  );
}
