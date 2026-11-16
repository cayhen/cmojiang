'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { CONTAINER } from '@/components/container';
import { Spinner } from '@/components/icons';

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function NewCollectionPage() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [eventDate, setEventDate] = useState(today);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password, event_date: eventDate }),
      });

      if (res.ok) {
        window.location.href = '/admin/dashboard';
      } else {
        const data: { error?: string } = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to create');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-grouped pb-16">
      <PageHeader title="New Collection" back={{ href: '/admin/dashboard', label: 'Collections' }} />

      <form onSubmit={handleSubmit} className={`${CONTAINER.narrow} space-y-8`}>
        <section>
          <label htmlFor="new-name" className="list-header block">Name</label>
          <div className="list p-2">
            <input
              id="new-name"
              type="text"
              placeholder="Collection name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
              className="field"
            />
          </div>
        </section>

        <section>
          <label htmlFor="new-password" className="list-header block">Password</label>
          <div className="list p-2">
            <input
              id="new-password"
              type="password"
              placeholder="Collection password"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="field"
            />
          </div>
          <p className="list-footer">Visitors enter this to open the collection. It stays visible on the dashboard so you can re-share it.</p>
        </section>

        <section>
          <label htmlFor="new-date" className="list-header block">Event date</label>
          <div className="list p-2">
            <input
              id="new-date"
              type="date"
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
              required
              className="field min-w-0 [&::-webkit-date-and-time-value]:text-left"
            />
          </div>
          <p className="list-footer">Collections are ordered by event date on the home page.</p>
        </section>

        <div>
          <button type="submit" disabled={loading} className="btn btn-filled w-full">
            {loading ? (
              <>
                <Spinner />
                <span className="sr-only">Creating…</span>
              </>
            ) : (
              'Create Collection'
            )}
          </button>
          {error && (
            <p role="alert" className="animate-rise px-4 pt-3 text-center text-footnote text-destructive">
              {error}
            </p>
          )}
        </div>
      </form>
    </main>
  );
}
