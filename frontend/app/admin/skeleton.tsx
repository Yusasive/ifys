export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-paper-2 animate-pulse rounded-sm ${className}`} />;
}

export function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="border border-line rounded-sm p-4 bg-white">
          <Skeleton className="h-3 w-20 mb-3" />
          <Skeleton className="h-7 w-12" />
        </div>
      ))}
    </div>
  );
}

export function TableRowsSkeleton({ rows = 5, cols }: { rows?: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-line last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3">
              <Skeleton className="h-4 w-full max-w-[8rem]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function DetailCardSkeleton() {
  return (
    <div className="border border-line rounded-sm bg-white p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-5 w-16" />
      </div>

      <div className="grid grid-cols-2 gap-y-2 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="contents">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24 justify-self-end" />
          </div>
        ))}
      </div>

      <div className="border-t border-line pt-4">
        <Skeleton className="h-3 w-24 mb-3" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full mb-2" />
        ))}
      </div>
    </div>
  );
}
