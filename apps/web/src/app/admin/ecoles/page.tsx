import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { COUNTRIES, date, SUBSCRIPTION, VERIFICATION } from "@/lib/format";
import type { SubscriptionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { SchoolRow } from "../data";
import { SchoolActions } from "./school-actions";
import { SearchInput } from "@/components/search-input";

export const metadata: Metadata = { title: "Écoles" };

const STATUSES = Object.keys(SUBSCRIPTION) as SubscriptionStatus[];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || name.slice(0, 2).toUpperCase();

export default async function SchoolsPage({ searchParams }: PageProps<"/admin/ecoles">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const status = STATUSES.find((s) => s === sp.statut);
  // ponytail: comptes calculés sur les 200 écoles renvoyées par l'API ; endpoint de stats quand on dépassera.
  const all = await api<SchoolRow[]>(`/platform/schools${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  const rows = status ? all.filter((s) => s.subscriptionStatus === status) : all;
  const tabs: { key?: SubscriptionStatus; label: string; count: number }[] = [
    { label: "Toutes", count: all.length },
    ...STATUSES.map((s) => ({ key: s, label: SUBSCRIPTION[s].label, count: all.filter((x) => x.subscriptionStatus === s).length })),
  ];
  const href = (s?: SubscriptionStatus) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (s) p.set("statut", s);
    const str = p.toString();
    return str ? `/admin/ecoles?${str}` : "/admin/ecoles";
  };

  return (
    <>
      <PageHeader title="Écoles" description="Toutes les écoles inscrites, des plus récentes aux plus anciennes." />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Statut d’abonnement" className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
          {tabs.map((t) => {
            const active = t.key === status;
            return (
              <Link
                key={t.label}
                href={href(t.key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    active ? "bg-accent text-accent-foreground" : "bg-background/70",
                  )}
                >
                  {t.count}
                </span>
              </Link>
            );
          })}
        </nav>
        <SearchInput defaultValue={q} placeholder="Rechercher une école…" label="Rechercher une école par son nom" />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-5" aria-hidden />}
          title={q ? `Aucune école pour « ${q} »` : "Aucune école dans cet état"}
          description={q ? "Vérifiez l’orthographe ou cherchez une partie du nom." : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-background shadow-xs">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">École</TableHead>
                <TableHead>Abonnement</TableHead>
                <TableHead className="hidden md:table-cell">Vérification</TableHead>
                <TableHead className="hidden lg:table-cell">Offre</TableHead>
                <TableHead className="hidden xl:table-cell">Fin de période</TableHead>
                <TableHead className="hidden xl:table-cell">Inscrite le</TableHead>
                <TableHead className="w-12 pr-4">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id} className="group">
                  <TableCell className="py-3 pl-4">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-xs font-semibold text-accent-foreground">
                        {initials(s.name)}
                      </span>
                      <div className="min-w-0">
                        <Link href={`/admin/verifications/${s.id}`} className="block truncate font-medium hover:text-primary">
                          {s.name}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                          {s.slug ? `${s.slug}.soukoulou.com` : `${s.city}, ${COUNTRIES[s.country] ?? s.country}`}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={SUBSCRIPTION[s.subscriptionStatus].tone}>{SUBSCRIPTION[s.subscriptionStatus].label}</StatusBadge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <StatusBadge tone={VERIFICATION[s.verificationStatus].tone}>{VERIFICATION[s.verificationStatus].label}</StatusBadge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {s.plan ? <span className="font-medium">{s.plan.name}</span> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground xl:table-cell">{date(s.subscriptionEndsAt)}</TableCell>
                  <TableCell className="hidden text-muted-foreground xl:table-cell">{date(s.createdAt)}</TableCell>
                  <TableCell className="pr-4 text-right">
                    <SchoolActions schoolId={s.id} name={s.name} suspended={s.subscriptionStatus === "SUSPENDED"} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
