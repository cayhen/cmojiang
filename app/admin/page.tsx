'use client';

import { createBrowserClient } from '@supabase/ssr';

export default function AdminSignIn() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/admin/dashboard` },
    });
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-xs text-center">
        <p className="text-[#3a3a3a] text-xs tracking-widest uppercase mb-8 font-light">Admin</p>
        <button
          onClick={signInWithGoogle}
          className="w-full bg-[#161616] border border-[#1a1a1a] text-[#666] text-sm py-2.5 rounded hover:border-[#2a2a2a] hover:text-[#888] transition-colors"
        >
          Sign in with Google
        </button>
      </div>
    </main>
  );
}
