"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ALL = "__all";

/** Filtre de liste dans l'URL (`?param=`) ; revient à la page 1. */
export function FilterSelect({
  param,
  value,
  options,
  label,
  allLabel,
}: {
  param: string;
  value: string;
  options: [string, string][];
  label: string;
  allLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  return (
    <Select
      value={value || ALL}
      onValueChange={(v) => {
        const p = new URLSearchParams(params);
        if (v === ALL) p.delete(param);
        else p.set(param, v);
        p.delete("page");
        start(() => router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false }));
      }}
    >
      <SelectTrigger aria-label={label} className={cn("h-10 w-full bg-background shadow-xs sm:w-44", pending && "opacity-60")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allLabel && <SelectItem value={ALL}>{allLabel}</SelectItem>}
        {options.map(([v, text]) => (
          <SelectItem key={v} value={v}>
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Choix du jour (`?param=AAAA-MM-JJ`), jamais dans le futur. */
export function DayInput({ param, value, max, label }: { param: string; value: string; max: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  return (
    <input
      type="date"
      aria-label={label}
      value={value}
      max={max}
      onChange={(e) => {
        if (!e.target.value) return;
        const p = new URLSearchParams(params);
        p.set(param, e.target.value);
        start(() => router.replace(`${pathname}?${p}`, { scroll: false }));
      }}
      className={cn(
        "h-10 w-full rounded-lg border bg-background px-3 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-44",
        pending && "opacity-60",
      )}
    />
  );
}
