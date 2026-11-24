import type { Notice } from "@/components/header-tools";
import { ago, date, daysUntil } from "./format";
import type { AppNotification, Onboarding } from "./types";

/** Notifications enregistrées (paiements, annonces, absences…) pour la cloche. Sans lien : la page d'accueil. */
export const storedNotices = (items: AppNotification[], home: string): Notice[] =>
  items.map((n) => ({
    id: n.id,
    title: n.title,
    detail: n.body ?? undefined,
    time: ago(n.createdAt),
    href: n.href ?? home,
    unread: !n.readAt,
  }));

/** Alertes déduites de l'état du dossier (tant que la situation dure). */
export function schoolNotices({ school, requirements }: Onboarding): Notice[] {
  const base = `/ecole/${school.id}`;
  const out: Notice[] = [];
  if (school.verificationStatus === "CHANGES_REQUESTED") {
    out.push({ id: "changes", title: "Corrections demandées", detail: "Remplacez les pièces signalées puis renvoyez le dossier.", href: `${base}/pieces`, unread: true });
  }
  for (const r of requirements) {
    if (r.document?.reviewStatus === "REJECTED") {
      out.push({ id: `rej-${r.id}`, title: `Pièce à remplacer : ${r.name}`, detail: r.document.reviewComment ?? undefined, href: `${base}/pieces`, unread: true });
    } else if (r.overdue) {
      out.push({ id: `late-${r.id}`, title: `Pièce en retard : ${r.name}`, detail: "Invitations et encaissements bloqués jusqu’à l’envoi.", href: `${base}/pieces`, unread: true });
    } else if (r.dueDate && !r.document) {
      out.push({ id: `due-${r.id}`, title: `Nouvelle pièce : ${r.name}`, detail: `À envoyer avant le ${date(r.dueDate)}.`, href: `${base}/pieces`, unread: true });
    }
  }
  if (school.verificationStatus === "PENDING") {
    out.push({ id: "pending", title: "Dossier en cours de vérification", detail: "Réponse sous 48 h ouvrées.", href: `${base}/pieces` });
  }
  if (school.subscriptionStatus === "DISCOVERY" && school.discoveryExpiresAt) {
    const left = daysUntil(school.discoveryExpiresAt);
    if (left <= 5) {
      out.push({ id: "discovery", title: `Découverte : ${left} jour${left > 1 ? "s" : ""} restant${left > 1 ? "s" : ""}`, detail: "Passez à l’abonnement pour garder votre compte.", href: `${base}/upgrade`, unread: true });
    }
  }
  if (school.subscriptionStatus === "ACTIVE" && school.subscriptionEndsAt) {
    const left = daysUntil(school.subscriptionEndsAt);
    if (left <= 14) {
      out.push({ id: "renew", title: `Abonnement : fin dans ${left} jour${left > 1 ? "s" : ""}`, detail: "Renouvelez pour éviter la suspension.", href: `${base}/abonnement`, unread: true });
    }
  }
  return out;
}
