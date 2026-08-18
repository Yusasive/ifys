"use client";

export function PaginationFooter({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <span className="text-sage">
        {total} total · page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="border border-emerald/20 px-4 py-1.5 rounded-full disabled:opacity-40 hover:bg-emerald/5 transition-colors"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="border border-emerald/20 px-4 py-1.5 rounded-full disabled:opacity-40 hover:bg-emerald/5 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
