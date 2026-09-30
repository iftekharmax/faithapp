import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckCircle2, Undo2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUndoDurationMs } from "@/lib/undo-prefs";

export interface UndoToastLink {
  label: string;
  to?: string;
  params?: Record<string, string>;
  onClick?: () => void;
}

export interface UndoToastOptions {
  title: string;
  description?: string;
  undoLabel: string;
  onUndo: () => void | Promise<void>;
  link?: UndoToastLink;
  duration?: number;
}

export function showUndoToast(opts: UndoToastOptions) {
  const duration = opts.duration ?? getUndoDurationMs();
  return toast.custom(
    (id) => (
      <UndoToastCard
        {...opts}
        duration={duration}
        onDismiss={() => toast.dismiss(id)}
      />
    ),
    { duration },
  );
}

function UndoToastCard({
  title, description, undoLabel, onUndo, link, duration, onDismiss,
}: UndoToastOptions & { duration: number; onDismiss: () => void }) {
  const [remaining, setRemaining] = useState(duration);
  const startRef = useRef<number>(Date.now());
  const rafRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const pauseStart = useRef<number | null>(null);
  const pausedTotal = useRef(0);

  useEffect(() => {
    const tick = () => {
      if (!pausedRef.current) {
        const elapsed = Date.now() - startRef.current - pausedTotal.current;
        const left = Math.max(0, duration - elapsed);
        setRemaining(left);
        if (left <= 0) return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [duration]);

  const pause = () => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    pauseStart.current = Date.now();
  };
  const resume = () => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    if (pauseStart.current) pausedTotal.current += Date.now() - pauseStart.current;
    pauseStart.current = null;
  };

  const pct = Math.max(0, Math.min(100, (remaining / duration) * 100));
  const secondsLeft = Math.ceil(remaining / 1000);

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      className={cn(
        "pointer-events-auto w-full max-w-sm overflow-hidden rounded-xl border border-border/60 bg-background/95 shadow-lg backdrop-blur",
      )}
    >
      <div className="flex items-start gap-3 p-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-foreground">{title}</p>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => { onDismiss(); await onUndo(); }}
              className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary transition hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Undo: ${undoLabel}`}
            >
              <Undo2 className="h-3 w-3" aria-hidden />
              {undoLabel}
            </button>
            {link && (link.to ? (
              <Link
                to={link.to as never}
                params={link.params as never}
                onClick={() => { onDismiss(); link.onClick?.(); }}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ExternalLink className="h-3 w-3" aria-hidden />
                {link.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => { onDismiss(); link.onClick?.(); }}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ExternalLink className="h-3 w-3" aria-hidden />
                {link.label}
              </button>
            ))}
            <span
              className="ml-auto tabular-nums text-[11px] text-muted-foreground"
              aria-label={`${secondsLeft} seconds remaining to undo`}
            >
              {secondsLeft}s
            </span>
          </div>
        </div>
      </div>
      <div
        className="h-1 w-full bg-border/40"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label="Time remaining to undo"
      >
        <div
          className="h-full bg-primary transition-[width] duration-100 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
