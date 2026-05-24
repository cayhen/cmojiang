import Link from 'next/link';

interface Props {
  id: string;
  name: string;
  photo_count: number;
}

export function CollectionCard({ id, name, photo_count }: Props) {
  return (
    <Link
      href={`/c/${id}`}
      className="block bg-[#161616] border border-[#1a1a1a] rounded p-4 hover:border-[#2a2a2a] transition-colors"
    >
      <p className="text-[#bbb] text-sm font-light">{name}</p>
      <p className="text-[#666] text-xs mt-1 font-light">
        {photo_count} {photo_count === 1 ? 'photo' : 'photos'}
      </p>
    </Link>
  );
}
