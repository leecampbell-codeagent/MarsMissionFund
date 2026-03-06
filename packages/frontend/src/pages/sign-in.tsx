import { SignIn } from '@clerk/react';

export default function SignInPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-bg-page)',
        padding: '24px',
      }}
    >
      <SignIn routing="path" path="/sign-in" />
    </div>
  );
}
