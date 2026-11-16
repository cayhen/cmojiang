import { AuthForm } from '@/components/AuthForm';

// Google sign-in (/api/auth/google) stays disabled here until it's configured.
export default function SignUpPage() {
  return (
    <AuthForm
      title="Create Account"
      subtitle="Keep the photos you like and get back into galleries without a password."
      endpoint="/api/signup"
      fallbackError="Couldn't create your account. Please try again."
      submitLabel="Create Account"
      fields={[
        { name: 'username', type: 'text', placeholder: 'Username', autoComplete: 'username' },
        { name: 'email', type: 'email', placeholder: 'Email', autoComplete: 'email' },
        { name: 'password', type: 'password', placeholder: 'Password', autoComplete: 'new-password', minLength: 8 },
      ]}
      footnote="Passwords need at least 8 characters."
      footer={{ prompt: 'Already have an account?', href: '/login', label: 'Sign in' }}
    />
  );
}
