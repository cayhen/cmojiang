'use client';

import { useState } from 'react';

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

export function CommentSection({ collectionId, initialComments, currentUsername, onCountChange }: Props) {
  const [comments, setComments] = useState(initialComments);

  function updateComments(next: Comment[]) {
    setComments(next);
    onCountChange?.(next.length);
  }
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

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
        const data = await res.json();
        setError(data.error ?? 'Failed to post');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(commentId: string) {
    if (!window.confirm('Delete this comment?')) return;
    const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
    if (res.ok) {
      updateComments(comments.filter(c => c.id !== commentId));
    }
  }

  return (
    <section className="py-5 border-b border-[#1a1a1a] mb-6">


      {comments.length === 0 && (
        <p className="text-[#666] text-sm font-light mb-4">No comments yet.</p>
      )}

      <div className="space-y-4 mb-6">
        {comments.map(c => (
          <div key={c.id} className="group">
            <div className="flex items-baseline justify-between">
              <span className="text-[#777] text-xs">{c.username}</span>
              <span className="text-[#555] text-xs">
                {new Date(c.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-start justify-between mt-0.5">
              <p className="text-[#bbb] text-sm font-light">{c.content}</p>
              {currentUsername === c.username && (
                <button
                  onClick={() => handleDelete(c.id)}
                  className="text-[#555] hover:text-[#777] text-xs ml-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  aria-label="Delete comment"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {currentUsername ? (
        <form onSubmit={handlePost} className="flex gap-2">
          <input
            type="text"
            placeholder="Add a comment..."
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            className="flex-1 bg-[#161616] border border-[#1a1a1a] rounded px-3 py-2 text-[#bbb] text-sm placeholder:text-[#666] focus:outline-none focus:border-[#2a2a2a] font-light"
          />
          <button
            type="submit"
            disabled={posting || !newComment.trim()}
            className="bg-[#161616] border border-[#1a1a1a] text-[#888] text-sm px-4 rounded hover:border-[#2a2a2a] hover:text-[#bbb] transition-colors disabled:opacity-50"
          >
            {posting ? '...' : 'Post'}
          </button>
        </form>
      ) : (
        <p className="text-[#666] text-xs">
          <a href="/login" className="hover:text-[#777] transition-colors">Sign in</a> to leave a comment.
        </p>
      )}
      {error && <p className="text-red-500/70 text-xs mt-1">{error}</p>}
    </section>
  );
}
