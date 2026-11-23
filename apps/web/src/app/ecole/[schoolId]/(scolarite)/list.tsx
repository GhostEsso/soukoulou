import "server-only";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import { getOnboarding } from "@/lib/data";
import { cn } from "@/lib/utils";

export const PAGE_SIZE = 10;

type Params = Record<string, string | string[] | undefined>;
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** L'école peut-elle modifier ? (le layout affiche déjà la raison du blocage) */
export async function readOnlyOf(schoolId: string) {
  return (await getOnboarding(schoolId)).access.write !== null;
}

/** Filtre texte sans accents ni casse. */
export function matches(q: string, ...fields: (string | null | undefined)[]) {
  const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const n = norm(q.trim());
  return !n || fields.some((f) => f && norm(f).includes(n));
}

/**
 * Pagination côté page : la structure d'une école tient en quelques centaines de lignes.
 * ponytail: tout est chargé puis découpé ; passer à skip/take côté API au-delà de ~1 000 lignes.
 */
export function paginate<T>(rows: T[], sp: Params) {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(one(sp.page)) || 1));
  return { rows: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), page, pages, total: rows.length };
}

/** Carte de liste : titre, recherche, actions (filtres, ajout), tableau, pagination. */
export function ListCard({
  title,
  count,
  search,
  actions,
  children,
  pagination,
}: {
  title: string;
  count: number;
  search?: { value: string; placeholder: string; label: string };
  actions?: React.ReactNode;
  children: React.ReactNode;
  pagination?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card shadow-xs" aria-label={title}>
      <header className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center">
        <h1 className="flex-1 text-xl font-semibold tracking-tight">
          {title}
          <span className="ml-2 align-middle text-sm font-normal text-muted-foreground tabular-nums">{count}</span>
        </h1>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {search && <SearchInput defaultValue={search.value} placeholder={search.placeholder} label={search.label} />}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </header>
      {children}
      {pagination}
    </section>
  );
}

export function Pagination({ page, pages, sp, base }: { page: number; pages: number; sp: Params; base: string }) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (k !== "page" && one(v)) q.set(k, one(v));
    if (p > 1) q.set("page", String(p));
    return q.size ? `${base}?${q}` : base;
  };
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-2 border-t px-4 py-3 sm:px-5">
      <PageLink href={href(page - 1)} disabled={page === 1} label="Page précédente">
        <ChevronLeft aria-hidden /> Préc.
      </PageLink>
      <ol className="flex items-center gap-1">
        {pageWindow(page, pages).map((p, i) =>
          p === null ? (
            <li key={`gap-${i}`} aria-hidden className="px-1 text-sm text-muted-foreground">
              …
            </li>
          ) : (
          <li key={p}>
            <Link
              href={href(p)}
              scroll={false}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                "grid size-8 place-items-center rounded-md text-sm tabular-nums",
                p === page ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {p}
            </Link>
          </li>
          ),
        )}
      </ol>
      <PageLink href={href(page + 1)} disabled={page === pages} label="Page suivante">
        Suiv. <ChevronRight aria-hidden />
      </PageLink>
    </nav>
  );
}

/** 1 … 4 5 6 … 29 : première, dernière, et les voisines de la page courante. */
export function pageWindow(page: number, pages: number): (number | null)[] {
  const keep = [...new Set([1, page - 1, page, page + 1, pages])].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  return keep.flatMap((p, i) => (i > 0 && p - keep[i - 1] > 1 ? [null, p] : [p]));
}

function PageLink({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: React.ReactNode }) {
  if (disabled) {
    return (
      <Button variant="outline" size="sm" disabled aria-label={label}>
        {children}
      </Button>
    );
  }
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={href} scroll={false} aria-label={label}>
        {children}
      </Link>
    </Button>
  );
}

/** Ligne vide d'un tableau filtré. */
export function NoResult({ colSpan, filtered, empty }: { colSpan: number; filtered: boolean; empty: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-12 text-center text-sm text-muted-foreground">
        {filtered ? "Aucun résultat pour cette recherche." : empty}
      </td>
    </tr>
  );
}
