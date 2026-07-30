import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SmartPagination({
  page,
  pageCount,
  onPageChange,
  totalItems,
  pageSize,
  className,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  className?: string;
}) {
  if (pageCount <= 1 && !totalItems) return null;

  const windowSize = 5;
  const start = Math.max(1, Math.min(page - Math.floor(windowSize / 2), pageCount - windowSize + 1));
  const end = Math.min(pageCount, start + windowSize - 1);
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);

  const from = totalItems && pageSize ? (page - 1) * pageSize + 1 : 0;
  const to = totalItems && pageSize ? Math.min(totalItems, page * pageSize) : 0;

  return (
    <div className={cn("flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between", className)}>
      {totalItems !== undefined && pageSize ? (
        <p className="text-xs text-muted-foreground">
          {totalItems === 0 ? "No results" : <>Showing <b>{from}</b>–<b>{to}</b> of <b>{totalItems}</b></>}
        </p>
      ) : <span />}
      <div className="flex w-full items-center justify-center gap-1 sm:w-auto">
        <Button
          size="sm"
          variant="outline"
          className="h-9 px-2 sm:px-3"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="ml-1 hidden sm:inline">Prev</span>
        </Button>
        <div className="hidden items-center gap-1 sm:flex">
          {start > 1 && (
            <>
              <Button size="sm" variant="ghost" className="h-9 min-w-9 px-2" onClick={() => onPageChange(1)}>1</Button>
              {start > 2 && <span className="px-1 text-muted-foreground">…</span>}
            </>
          )}
          {pages.map((n) => (
            <Button
              key={n}
              size="sm"
              variant={n === page ? "default" : "ghost"}
              className="h-9 min-w-9 px-2"
              onClick={() => onPageChange(n)}
              aria-current={n === page ? "page" : undefined}
            >
              {n}
            </Button>
          ))}
          {end < pageCount && (
            <>
              {end < pageCount - 1 && <span className="px-1 text-muted-foreground">…</span>}
              <Button size="sm" variant="ghost" className="h-9 min-w-9 px-2" onClick={() => onPageChange(pageCount)}>
                {pageCount}
              </Button>
            </>
          )}
        </div>
        <div className="flex-1 text-center text-xs font-medium tabular-nums text-muted-foreground sm:hidden">
          Page {page} of {pageCount}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-9 px-2 sm:px-3"
          disabled={page >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          aria-label="Next page"
        >
          <span className="mr-1 hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
