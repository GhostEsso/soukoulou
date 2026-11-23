import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell, type NavItem } from "@/components/app-shell";
import { getMe } from "@/lib/data";
import { logout } from "../(auth)/actions";
import type { Notice } from "@/components/header-tools";
import { ago, todayLabel } from "@/lib/format";
import type { Alert } from "@/lib/types";
import { getAlerts, getPendingTransfers, getVerifications } from "./data";

const ALERT_TITLE: Record<Alert["type"], string> = {
  NEW_VERIFICATION: "Dossier à vérifier",
  RESUBMITTED: "Dossier corrigé et renvoyé",
  DOCUMENT_UPLOADED: "Nouvelle pièce envoyée",
  PAYMENT_TO_CONFIRM: "Virement à confirmer",
};

export const metadata: Metadata = { title: { template: "%s · Console Soukoulou", default: "Console Soukoulou" } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const me = await getMe();
  if (!me.isPlatformAdmin) notFound();
  const [pending, transfers, alerts] = await Promise.all([
    getVerifications("PENDING"),
    getPendingTransfers(),
    getAlerts(false),
  ]);
  const notices: Notice[] = alerts.items.slice(0, 15).map((a) => ({
    id: a.id,
    title: ALERT_TITLE[a.type],
    detail: `${a.school.name} · ${a.school.city}`,
    time: ago(a.createdAt),
    href: a.type === "PAYMENT_TO_CONFIRM" ? "/admin/paiements" : `/admin/verifications/${a.school.id}`,
    unread: !a.readAt,
  }));
  const n = (x: number) => (x > 0 ? x : undefined);

  const groups: { label?: string; items: NavItem[] }[] = [
    {
      items: [
        { href: "/admin", label: "Tableau de bord", icon: "home", exact: true },
        { href: "/admin/verifications", label: "Vérifications", icon: "verifications", badge: n(pending.length) },
        { href: "/admin/paiements", label: "Virements à confirmer", icon: "payments", badge: n(transfers.length) },
        { href: "/admin/ecoles", label: "Écoles", icon: "schools" },
      ],
    },
    {
      label: "Paramètres",
      items: [
        { href: "/admin/offres", label: "Offres", icon: "plans" },
        { href: "/admin/pieces", label: "Pièces demandées", icon: "requirements" },
        { href: "/admin/calendriers", label: "Années scolaires", icon: "calendars" },
      ],
    },
  ];

  return (
    <AppShell
      title="Soukoulou"
      subtitle="Console d’administration"
      groups={groups}
      user={{ name: `${me.firstName} ${me.lastName}`, email: me.email }}
      logoutAction={logout}
      tools={{ today: todayLabel(), notices, noticesHref: "/admin#alertes" }}
    >
      {children}
    </AppShell>
  );
}
