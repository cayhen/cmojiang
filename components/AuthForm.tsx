'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TopBar } from './PageHeader';
import { Spinner } from './icons';

interface Field {
  name: string;
  type: 'text' | 'email' | 'password';
  placeholder: string;
  autoComplete: string;
  minLength?: number;
}

interface Props {
  title: string;
  subtitle: string;
  fields: Field[];
  submitLabel: string;
  endpoint: string;
  fallbackError: string;
  footer: { prompt: string; href: string; label: string };
  footnote?: string;
}

/** Shared sign-in / sign-up screen: one grouped set of fields, one action. */
export function AuthForm({ title, subtitle, fields, submitLabel, endpoint, fallbackError, footer, footnote }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map(f => [f.name, ''])));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('error') === 'oauth') {
      setError('Google sign-in failed. Please try again.');
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (res.ok) {
        window.location.href = '/';
        return;
      }
      const data: { error?: string } = await res.json().catch(() => ({}));
      setError(data.error ?? fallbackError);
      setAttempt(a => a + 1);
    } catch {
      setError('Network error. Check your connection and try again.');
    }
    setLoading(false);
  }

  return (
    <main className="flex min-h-[100dvh] flex-col bg-grouped">
      <TopBar back={{ href: '/', label: 'Collections' }} />
      <div className="flex flex-1 items-center justify-center px-6 pb-24">
        <div className="animate-rise w-full max-w-sm">
          <h1 className="text-center text-title1">{title}</h1>
          <p className="mt-2 text-center text-subhead text-label2">{subtitle}</p>

          <form key={attempt} onSubmit={handleSubmit} className={`mt-8 ${attempt ? 'animate-shake' : ''}`}>
            <div className="list transition-shadow duration-150 focus-within:shadow-[0_0_0_3px_var(--ring)]">
              {fields.map((f, i) => (
                <div key={f.name} className="list-row min-h-0 p-0">
                  <input
                    name={f.name}
                    type={f.type}
                    placeholder={f.placeholder}
                    aria-label={f.placeholder}
                    autoComplete={f.autoComplete}
                    autoFocus={i === 0}
                    required
                    minLength={f.minLength}
                    value={values[f.name]}
                    onChange={e => { setValues(v => ({ ...v, [f.name]: e.target.value })); if (error) setError(''); }}
                    className="h-12 w-full bg-transparent px-4 text-body text-label outline-none placeholder:text-label2"
                  />
                </div>
              ))}
            </div>
            {footnote && <p className="list-footer">{footnote}</p>}
            <p role="alert" className="min-h-[18px] px-4 pt-2 text-footnote text-destructive">{error}</p>
            <button type="submit" disabled={loading} className="btn btn-filled mt-2 w-full">
              {loading ? <Spinner size={18} /> : submitLabel}
            </button>
          </form>

          <p className="mt-6 text-center text-subhead text-label2">
            {footer.prompt}{' '}
            <Link href={footer.href} className="link">{footer.label}</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
