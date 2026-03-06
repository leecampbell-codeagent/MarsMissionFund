import { SignUp } from '@clerk/react';

export default function SignUpPage() {
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
      <SignUp routing="path" path="/sign-up" />
    </div>
  );
}
