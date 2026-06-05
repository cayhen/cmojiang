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
      className="group block bg-[#161616] border border-[#1a1a1a] rounded p-4 hover:border-[#252525] transition-colors relative overflow-hidden"
    >
      {/* Left accent bar — grows from bottom on hover */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#444] scale-y-0 origin-bottom group-hover:scale-y-100 transition-transform duration-300" />

      <p className="text-[#bbb] text-sm font-light group-hover:translate-x-1.5 group-hover:text-[#e0e0e0] transition-all duration-200">
        {name}
      </p>
      <div className="flex items-center justify-between mt-1 group-hover:translate-x-1.5 transition-transform duration-200">
        <p className="text-[#666] text-xs font-light group-hover:opacity-40 transition-opacity duration-200">
          {photo_count} {photo_count === 1 ? 'photo' : 'photos'}
        </p>
        {event_date && (
          <p className="text-[#444] text-xs font-light group-hover:opacity-60 transition-opacity duration-200">
            {formatDate(event_date)}
          </p>
        )}
      </div>
    </Link>
  );
}
