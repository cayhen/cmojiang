import { AuthForm } from '@/components/AuthForm';

// Google sign-in (/api/auth/google) stays disabled here until it's configured.
export default function LoginPage() {
  return (
    <AuthForm
      title="Sign In"
      subtitle="Like photos, leave comments, and skip passwords next time."
      endpoint="/api/login"
      fallbackError="Couldn't sign you in. Please try again."
      submitLabel="Sign In"
      fields={[
        { name: 'username', type: 'text', placeholder: 'Username', autoComplete: 'username' },
        { name: 'password', type: 'password', placeholder: 'Password', autoComplete: 'current-password' },
      ]}
      footer={{ prompt: 'No account?', href: '/signup', label: 'Create one' }}
    />
  );
}
