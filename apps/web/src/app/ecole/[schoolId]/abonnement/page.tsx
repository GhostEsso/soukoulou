import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOnboarding, getPlans } from "@/lib/data";
import { date, daysUntil, money, SUBSCRIPTION } from "@/lib/format";
import { PlanPicker } from "../plan-picker";

export const metadata: Metadata = { title: "Abonnement" };

export default async function SubscriptionPage({ params }: PageProps<"/ecole/[schoolId]/abonnement">) {
  const { schoolId } = await params;
  const [{ school }, plans] = await Promise.all([getOnboarding(schoolId), getPlans()]);
  if (school.subscriptionStatus === "DISCOVERY") redirect(`/ecole/${school.id}/upgrade`);

  const status = SUBSCRIPTION[school.subscriptionStatus];
  const left = school.subscriptionEndsAt ? daysUntil(school.subscriptionEndsAt) : null;
  const blocked = Boolean(school.suspendedReason) || school.verificationStatus === "REJECTED";

  return (
    <>
      <PageHeader title="Abonnement" description="Votre offre, sa date de fin et son renouvellement." />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Offre actuelle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-xl font-semibold">{school.plan?.name ?? "—"}</p>
            {school.plan && (
              <p className="text-sm text-muted-foreground">{money(school.plan.priceMonthly, school.plan.currency)} par mois</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Statut</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Fin de période</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-xl font-semibold">{date(school.subscriptionEndsAt)}</p>
            {left !== null && (
              <p className="text-sm text-muted-foreground">
                {left > 0 ? `Dans ${left} jour${left > 1 ? "s" : ""}` : "Période terminée"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="mt-10 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Renouveler</h2>
          <p className="text-sm text-muted-foreground">
            La nouvelle période commence à la fin de la période en cours. Changer d’offre en cours d’année sera bientôt
            possible.
          </p>
        </div>
        {blocked ? (
          <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
            Ce compte est bloqué. Contactez Soukoulou pour le renouvellement.
          </p>
        ) : (
          <PlanPicker
            schoolId={school.id}
            plans={plans}
            lockedPlanCode={school.plan?.code}
            devPayments={process.env.NODE_ENV !== "production" && Boolean(process.env.PAYMENT_WEBHOOK_SECRET)}
          />
        )}
      </section>
    </>
  );
}
