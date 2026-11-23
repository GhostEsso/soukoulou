import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/format";

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground ring-border",
  info: "bg-accent text-accent-foreground ring-primary/15",
  success: "bg-success/10 text-success ring-success/20",
  warning: "bg-warning/10 text-[color-mix(in_oklch,var(--warning)_70%,black)] ring-warning/25",
  danger: "bg-destructive/10 text-destructive ring-destructive/20",
};

export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}
