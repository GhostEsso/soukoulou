import { AlertTriangle, Ban, Moon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { date } from "@/lib/format";
import type { Onboarding } from "@/lib/types";

/** Bandeau des situations qui bloquent l'école. Le mode découverte a sa propre page d'accueil. */
export function StatusBanner({ onboarding }: { onboarding: Onboarding }) {
  const { school, requirements } = onboarding;
  const base = `/ecole/${school.id}`;

  if (school.subscriptionStatus === "SUSPENDED") {
    const unpaid = !school.suspendedReason;
    return (
      <Banner tone="danger" icon={<Ban className="size-5" />} title="Votre école est suspendue">
        {unpaid
          ? "L’abonnement n’a pas été renouvelé. Vos données sont conservées : réabonnez-vous pour rouvrir l’accès."
          : school.suspendedReason}
        {unpaid && (
          <Button asChild size="sm" className="mt-3">
            <Link href={`${base}/abonnement`}>Renouveler l’abonnement</Link>
          </Button>
        )}
      </Banner>
    );
  }

  if (school.subscriptionStatus === "READ_ONLY") {
    return (
      <Banner tone="warning" icon={<Moon className="size-5" />} title="Vacances : lecture seule">
        Tout le monde peut consulter les notes et les bulletins, mais rien ne peut être modifié. Réabonnez-vous
        avant la rentrée pour continuer sans interruption.
        <Button asChild size="sm" variant="outline" className="mt-3 bg-background">
          <Link href={`${base}/abonnement`}>Se réabonner</Link>
        </Button>
      </Banner>
    );
  }

  const overdue = requirements.filter((r) => r.overdue);
  if (overdue.length) {
    return (
      <Banner tone="warning" icon={<AlertTriangle className="size-5" />} title="Pièce justificative en retard">
        {overdue.map((r) => r.name).join(", ")} : les nouvelles invitations et l’encaissement des frais sont bloqués
        jusqu’à l’envoi.
        <Button asChild size="sm" variant="outline" className="mt-3 bg-background">
          <Link href={`${base}/pieces`}>Envoyer la pièce</Link>
        </Button>
      </Banner>
    );
  }

  const soon = requirements.filter((r) => r.dueDate && !r.document && new Date(r.dueDate) > new Date());
  if (soon.length && school.verificationStatus === "VERIFIED") {
    return (
      <Banner tone="info" icon={<AlertTriangle className="size-5" />} title="Nouvelle pièce à fournir">
        {soon.map((r) => `${r.name} (avant le ${date(r.dueDate)})`).join(", ")}.
        <Button asChild size="sm" variant="outline" className="mt-3 bg-background">
          <Link href={`${base}/pieces`}>Envoyer la pièce</Link>
        </Button>
      </Banner>
    );
  }
  return null;
}

const TONES = {
  danger: "border-destructive/25 bg-destructive/5 [&_svg]:text-destructive",
  warning: "border-warning/30 bg-warning/5 [&_svg]:text-warning",
  info: "border-primary/20 bg-accent [&_svg]:text-primary",
};

function Banner({
  tone,
  icon,
  title,
  children,
}: {
  tone: keyof typeof TONES;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" className={`mb-6 flex gap-3 rounded-xl border p-4 ${TONES[tone]}`}>
      <div className="mt-0.5 shrink-0" aria-hidden>
        {icon}
      </div>
      <div className="text-sm">
        <p className="font-semibold">{title}</p>
        <div className="mt-1 flex flex-col items-start text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}
