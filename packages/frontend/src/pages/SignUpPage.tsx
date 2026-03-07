import { SignUp } from '@clerk/react';
import { AuthPageLayout } from '../components/auth/AuthPageLayout';
import { clerkAppearance } from '../lib/clerkAppearance';

export default function SignUpPage() {
  return (
    <AuthPageLayout subtitle="Join the mission. Back the future.">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/dashboard"
        appearance={clerkAppearance}
      />
    </AuthPageLayout>
  );
}
