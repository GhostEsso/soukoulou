import { cn } from "@/lib/utils";
import { LogoMark } from "./logo-mark";

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark
        size={28}
        background={inverted ? "#ffffff" : "var(--primary)"}
        page={inverted ? "var(--primary)" : "#ffffff"}
      />
      <span className={inverted ? "text-white" : "text-foreground"}>Soukoulou</span>
    </span>
  );
}
