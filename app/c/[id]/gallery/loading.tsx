// Shown instantly while the gallery renders on the server (no data, no cost).
const HEIGHTS = [220, 160, 260, 190, 240, 170, 210, 250, 180, 230, 200, 160];

export default function GalleryLoading() {
  return (
    <main className="min-h-screen bg-bg" aria-busy="true" aria-label="Loading photos">
      <div className="h-[calc(52px+env(safe-area-inset-top))]" />
      <div className="px-4 pb-4 pt-1 sm:px-6 lg:px-8">
        <div className="animate-shimmer h-9 w-56 rounded-lg bg-fill md:h-11" />
        <div className="animate-shimmer mt-2 h-4 w-40 rounded bg-fill" />
        <div className="mt-4 flex gap-2">
          <div className="animate-shimmer h-8 w-16 rounded-full bg-fill" />
          <div className="animate-shimmer h-8 w-16 rounded-full bg-fill" />
        </div>
      </div>
      <div className="flex gap-0.5 sm:gap-1.5 sm:px-6 lg:px-8">
        {[0, 1, 2].map(col => (
          <div key={col} className="flex flex-1 flex-col gap-0.5 sm:gap-1.5">
            {HEIGHTS.filter((_, i) => i % 3 === col).map((h, i) => (
              <div key={i} className="animate-shimmer rounded-[2px] bg-fill sm:rounded-tile" style={{ height: h, animationDelay: `${(col + i) * 90}ms` }} />
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
