import Link from 'next/link';

interface Props {
  id: string;
  name: string;
  photo_count: number;
  event_date?: string | null;
}

function formatDate(date: string): string {
  const [year, month] = date.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function CollectionCard({ id, name, photo_count, event_date }: Props) {
  return (
    <Link
      href={`/c/${id}`}
      className="block bg-[#161616] border border-[#1a1a1a] rounded p-4 hover:border-[#2a2a2a] transition-colors"
    >
      <p className="text-[#bbb] text-sm font-light">{name}</p>
      <div className="flex items-center justify-between mt-1">
        <p className="text-[#666] text-xs font-light">
          {photo_count} {photo_count === 1 ? 'photo' : 'photos'}
        </p>
        {event_date && (
          <p className="text-[#444] text-xs font-light">{formatDate(event_date)}</p>
        )}
      </div>
    </Link>
  );
}
