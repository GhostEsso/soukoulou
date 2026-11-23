import { ArrowRight, Banknote, Bell, CheckCheck, CheckCircle2, FileWarning, RotateCcw, ShieldCheck, Upload } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { getMe, getPlans } from "@/lib/data";
import { ago, date, daysUntil, money, SUBSCRIPTION, VERIFICATION } from "@/lib/format";
import type { Alert, SubscriptionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { readAlert } from "./actions";
import { getAlerts, getPendingTransfers, getVerifications, type SchoolRow } from "./data";

const ALERTS: Record<Alert["type"], { text: string; icon: typeof Bell; tone: string; href: (id: string) => string }> = {
  NEW_VERIFICATION: {
    text: "a payé et attend la vérification de ses pièces",
    icon: ShieldCheck,
    tone: "bg-accent text-accent-foreground",
    href: (id) => `/admin/verifications/${id}`,
  },
  RESUBMITTED: {
    text: "a corrigé et renvoyé son dossier",
    icon: RotateCcw,
    tone: "bg-accent text-accent-foreground",
    href: (id) => `/admin/verifications/${id}`,
  },
  DOCUMENT_UPLOADED: {
    text: "a envoyé une nouvelle pièce",
    icon: Upload,
    tone: "bg-muted text-muted-foreground",
    href: (id) => `/admin/verifications/${id}`,
  },
  PAYMENT_TO_CONFIRM: {
    text: "a déclaré un virement à confirmer",
    icon: Banknote,
    tone: "bg-warning/15 text-[color-mix(in_oklch,var(--warning)_70%,black)]",
    href: () => "/admin/paiements",
  },
};

const STATUS_COLORS: Record<SubscriptionStatus, string> = {
  ACTIVE: "bg-success",
  DISCOVERY: "bg-brand/40",
  READ_ONLY: "bg-warning",
  SUSPENDED: "bg-destructive",
};

// Rendu serveur à chaque requête : l'heure courante est voulue ici.
const createdSince = (rows: { createdAt: string }[], days: number) => {
  const from = Date.now() - days * 86_400_000;
  return rows.filter((r) => new Date(r.createdAt).getTime() > from).length;
};

export default async function AdminHome() {
  const [me, plans, alerts, pending, changes, transfers, schools] = await Promise.all([
    getMe(),
    getPlans(),
    getAlerts(false),
    getVerifications("PENDING"),
    getVerifications("CHANGES_REQUESTED"),
    getPendingTransfers(),
    // ponytail: l'API plafonne à 200 écoles ; un endpoint de statistiques quand on les dépassera.
    api<SchoolRow[]>("/platform/schools"),
  ]);
  const todo = pending.length + transfers.length;
  const oldest = pending[0];
  const newThisWeek = createdSince(schools, 7);
  const byStatus = (Object.keys(SUBSCRIPTION) as SubscriptionStatus[]).map((s) => ({
    status: s,
    count: schools.filter((x) => x.subscriptionStatus === s).length,
  }));
  const latest = schools.slice(0, 5);
  const renewals = schools
    .filter((s) => s.subscriptionStatus === "ACTIVE" && s.subscriptionEndsAt && daysUntil(s.subscriptionEndsAt) <= 30)
    .sort((a, b) => a.subscriptionEndsAt!.localeCompare(b.subscriptionEndsAt!))
    .slice(0, 5);
  // Estimation : prix mensuel actuel de l'offre × écoles actives (les remises annuelles ne sont pas déduites).
  const byPlan = plans.map((p) => {
    const count = schools.filter((s) => s.subscriptionStatus === "ACTIVE" && s.plan?.code === p.code).length;
    return { ...p, count, revenue: count * p.priceMonthly };
  });
  const mrr = byPlan.reduce((sum, p) => sum + p.revenue, 0);
  const maxRevenue = Math.max(1, ...byPlan.map((p) => p.revenue));
  const unread = alerts.items.filter((a) => !a.readAt);
  const read = alerts.items.filter((a) => a.readAt);

  const kpis = [
    {
      label: "Dossiers à vérifier",
      value: pending.length,
      hint: oldest ? `Le plus ancien : ${ago(oldest.updatedAt)}` : "Aucun en attente",
      href: "/admin/verifications",
      icon: ShieldCheck,
      urgent: true,
    },
    {
      label: "Virements à confirmer",
      value: transfers.length,
      hint: "Vérifiez le relevé bancaire",
      href: "/admin/paiements",
      icon: Banknote,
      urgent: true,
    },
    {
      label: "En attente de correction",
      value: changes.length,
      hint: "L’école doit agir",
      href: "/admin/verifications?statut=CHANGES_REQUESTED",
      icon: FileWarning,
      urgent: false,
    },
    { label: "Alertes non lues", value: alerts.unread, hint: "Voir ci-dessous", href: "#alertes", icon: Bell, urgent: false },
  ];

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bonjour {me.firstName}</h1>
        </div>
        {todo > 0 ? (
          <p className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground">
            <span className="size-2 rounded-full bg-primary" aria-hidden />
            {todo} action{todo > 1 ? "s" : ""} en attente
          </p>
        ) : (
          <p className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1.5 text-sm font-medium text-success">
            <CheckCircle2 className="size-4" aria-hidden /> Tout est à jour
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => {
          const hot = k.urgent && k.value > 0;
          return (
            <Link
              key={k.label}
              href={k.href}
              className={cn(
                "group flex flex-col gap-4 rounded-xl border bg-background p-5 shadow-xs transition-all outline-none hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50",
                hot && "border-primary/30 bg-accent/40",
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">{k.label}</p>
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-lg",
                    hot ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  <k.icon className="size-4.5" aria-hidden />
                </span>
              </div>
              <p className={cn("text-4xl font-semibold tracking-tight tabular-nums", k.value === 0 && "text-foreground/30")}>
                {k.value}
              </p>
              <p className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{k.hint}</span>
                {hot && (
                  <span className="inline-flex items-center gap-1 font-medium text-primary">
                    Traiter <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                )}
              </p>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section id="alertes" aria-labelledby="alertes-title" className="flex flex-col rounded-xl border bg-background shadow-xs lg:col-span-2">
          <header className="flex items-center justify-between border-b px-5 py-4">
            <h2 id="alertes-title" className="font-semibold">
              Alertes
            </h2>
            {unread.length > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                {unread.length} nouvelle{unread.length > 1 ? "s" : ""}
              </span>
            )}
          </header>
          {alerts.items.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<Bell className="size-5" aria-hidden />}
                title="Aucune alerte"
                description="Les nouveaux dossiers et virements apparaîtront ici."
              />
            </div>
          ) : (
            <ul className="divide-y">
              {[...unread, ...read].map((a) => {
                const t = ALERTS[a.type];
                return (
                  <li key={a.id} className={cn("flex items-center gap-4 px-5 py-4", a.readAt && "opacity-60")}>
                    <span className={cn("relative grid size-10 shrink-0 place-items-center rounded-full", t.tone)}>
                      <t.icon className="size-4.5" aria-hidden />
                      {!a.readAt && (
                        <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-background bg-primary">
                          <span className="sr-only">Non lue</span>
                        </span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{a.school.name}</span>{" "}
                        <span className="text-muted-foreground">{t.text}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.school.city} · {ago(a.createdAt)}
                      </p>
                    </div>
                    {!a.readAt && (
                      <form action={readAlert.bind(null, a.id)} className="hidden sm:block">
                        <Button type="submit" variant="ghost" size="icon" aria-label="Marquer comme lue" title="Marquer comme lue">
                          <CheckCheck aria-hidden />
                        </Button>
                      </form>
                    )}
                    <Button asChild variant="outline" size="sm">
                      <Link href={t.href(a.school.id)}>
                        Ouvrir <ArrowRight aria-hidden />
                      </Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside aria-labelledby="ecoles-title" className="rounded-xl border bg-background shadow-xs">
          <header className="flex items-center justify-between border-b px-5 py-4">
            <h2 id="ecoles-title" className="font-semibold">
              Écoles
            </h2>
            <Link href="/admin/ecoles" className="text-xs font-medium text-primary hover:underline">
              Tout voir
            </Link>
          </header>
          <div className="space-y-5 p-5">
            <div className="flex items-end justify-between">
              <p className="text-4xl font-semibold tracking-tight tabular-nums">{schools.length}</p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">+{newThisWeek}</span> cette semaine
              </p>
            </div>
            {schools.length > 0 && (
              <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                {byStatus.map(
                  (s) =>
                    s.count > 0 && (
                      <span
                        key={s.status}
                        className={STATUS_COLORS[s.status]}
                        style={{ width: `${(s.count / schools.length) * 100}%` }}
                      />
                    ),
                )}
              </div>
            )}
            <ul className="space-y-2.5 text-sm">
              {byStatus.map((s) => (
                <li key={s.status}>
                  <Link
                    href={`/admin/ecoles?statut=${s.status}`}
                    className="flex items-center gap-2.5 rounded-md hover:text-primary"
                  >
                    <span className={cn("size-2.5 rounded-full", STATUS_COLORS[s.status])} aria-hidden />
                    <span className="flex-1">{SUBSCRIPTION[s.status].label}</span>
                    <span className="font-medium tabular-nums">{s.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="Dernières inscriptions" href="/admin/ecoles" linkLabel="Toutes les écoles">
          {latest.length === 0 ? (
            <Empty>Aucune école inscrite.</Empty>
          ) : (
            <ul className="divide-y">
              {latest.map((s) => (
                <li key={s.id}>
                  <Link href={`/admin/verifications/${s.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-xs font-semibold text-accent-foreground">
                      {s.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {s.city} · {ago(s.createdAt)}
                      </span>
                    </span>
                    <StatusBadge tone={VERIFICATION[s.verificationStatus].tone}>{VERIFICATION[s.verificationStatus].label}</StatusBadge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="À renouveler sous 30 jours" href="/admin/ecoles?statut=ACTIVE" linkLabel="Écoles actives">
          {renewals.length === 0 ? (
            <Empty>Aucun abonnement n’arrive à échéance ce mois-ci.</Empty>
          ) : (
            <ul className="divide-y">
              {renewals.map((s) => {
                const left = daysUntil(s.subscriptionEndsAt!);
                return (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {s.plan?.name} · fin le {date(s.subscriptionEndsAt)}
                      </span>
                    </span>
                    <StatusBadge tone={left <= 7 ? "danger" : "warning"}>J−{left}</StatusBadge>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Revenu mensuel estimé" href="/admin/offres" linkLabel="Offres" className="md:col-span-2 xl:col-span-1">
          <div className="space-y-5 p-5">
            <div>
              <p className="text-3xl font-semibold tracking-tight tabular-nums">{money(mrr)}</p>
              <p className="text-xs text-muted-foreground">Écoles actives × prix mensuel de leur offre</p>
            </div>
            <ul className="space-y-3">
              {byPlan.map((p) => (
                <li key={p.id} className="space-y-1.5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">
                      {p.name} <span className="font-normal text-muted-foreground">· {p.count} école{p.count > 1 ? "s" : ""}</span>
                    </span>
                    <span className="tabular-nums">{money(p.revenue)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(p.revenue / maxRevenue) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>
    </>
  );
}

function Panel({
  title,
  href,
  linkLabel,
  className,
  children,
}: {
  title: string;
  href: string;
  linkLabel: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex flex-col rounded-xl border bg-background shadow-xs", className)}>
      <header className="flex items-center justify-between border-b px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        <Link href={href} className="text-xs font-medium text-primary hover:underline">
          {linkLabel}
        </Link>
      </header>
      <div className="flex-1">{children}</div>
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="grid h-full min-h-32 place-items-center px-5 py-8 text-center text-sm text-muted-foreground">{children}</p>
);
