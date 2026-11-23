import { cn } from "@/lib/utils";

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span
        className={cn(
          "grid size-7 place-items-center rounded-lg text-sm font-bold",
          inverted ? "bg-white text-primary" : "bg-primary text-primary-foreground",
        )}
        aria-hidden
      >
        S
      </span>
      <span className={inverted ? "text-white" : "text-foreground"}>Soukoulou</span>
    </span>
  );
}
