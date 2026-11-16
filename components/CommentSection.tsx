'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpIcon, CommentIcon } from './icons';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  username: string;
}

interface Props {
  collectionId: string;
  initialComments: Comment[];
  currentUsername: string | null;
  onCountChange?: (count: number) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function CommentSection({ collectionId, initialComments, currentUsername, onCountChange }: Props) {
  const [comments, setComments] = useState(initialComments);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  function updateComments(next: Comment[]) {
    setComments(next);
    onCountChange?.(next.length);
  }

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setPosting(true);
    setError('');

    try {
      const res = await fetch(`/api/collections/${collectionId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() }),
      });

      if (res.ok) {
        const comment = await res.json();
        updateComments([...comments, comment]);
        setNewComment('');
      } else {
        const data: { error?: string } = await res.json().catch(() => ({}));
        setError(data.error ?? 'Couldn’t post your comment. Please try again.');
      }
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(commentId: string) {
    if (!window.confirm('Delete this comment?')) return;
    const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
    if (res.ok) {
      updateComments(comments.filter(c => c.id !== commentId));
    } else {
      setError('Couldn’t delete that comment. Please try again.');
    }
  }

  return (
    <div className="flex min-h-[40vh] flex-col">
      <div className="flex-1 px-4 pb-4">
        {comments.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-fill text-label2">
              <CommentIcon size={22} />
            </span>
            <p className="text-headline">No Comments Yet</p>
            <p className="mt-1 text-subhead text-label2">Be the first to say something about these photos.</p>
          </div>
        ) : (
          <ul className="space-y-4 pt-1">
            {comments.map(c => (
              <li key={c.id} className="animate-rise">
                <div className="flex items-baseline gap-2">
                  <span className="text-subhead font-semibold">{c.username}</span>
                  <span className="text-footnote text-label2">{formatDate(c.created_at)}</span>
                  {currentUsername === c.username && (
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="ml-auto text-footnote text-label2 transition-colors hover:text-destructive"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-body">{c.content}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sticky bottom-0 bg-surface px-4 pb-4 pt-2 hairline-t">
        {error && <p className="animate-rise pb-2 text-footnote text-destructive">{error}</p>}
        {currentUsername ? (
          <form onSubmit={handlePost} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Add a comment"
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              aria-label="Comment"
              className="field h-10 rounded-full"
            />
            <button
              type="submit"
              disabled={posting || !newComment.trim()}
              aria-label="Post comment"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tint text-white transition-[transform,opacity] duration-150 active:scale-90 disabled:opacity-30"
            >
              <ArrowUpIcon size={18} />
            </button>
          </form>
        ) : (
          <p className="py-2 text-center text-subhead text-label2">
            <Link href="/login" className="text-tint hover:opacity-70">Sign in</Link> to leave a comment.
          </p>
        )}
      </div>
    </div>
  );
}
