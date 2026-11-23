"use client";

import { Loader2, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";

/** Recherche instantanée : met à jour `?q=` après une courte pause de frappe (et revient à la page 1). */
export function SearchInput({
  defaultValue,
  placeholder,
  label,
}: {
  defaultValue: string;
  placeholder: string;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(defaultValue);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const push = (q: string) => {
    const p = new URLSearchParams(params);
    if (q.trim()) p.set("q", q.trim());
    else p.delete("q");
    p.delete("page");
    start(() => router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false }));
  };

  return (
    <div role="search" className="relative w-full lg:w-80">
      {pending ? (
        <Loader2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
      ) : (
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      )}
      <Input
        type="search"
        value={value}
        onChange={(e) => {
          const q = e.target.value;
          setValue(q);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => push(q), 300);
        }}
        placeholder={placeholder}
        aria-label={label}
        maxLength={80}
        className="h-10 bg-background pr-9 pl-9 shadow-xs [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            clearTimeout(timer.current);
            push("");
          }}
          aria-label="Effacer la recherche"
          className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
