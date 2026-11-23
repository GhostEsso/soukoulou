import { ArrowRight, Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getOnboarding, getPlans } from "@/lib/data";
import { upgradeProgress } from "@/lib/progress";
import { cn } from "@/lib/utils";
import { DocumentList } from "../document-list";
import { PlanPicker } from "../plan-picker";
import { InfoForm } from "./info-form";

export const metadata: Metadata = { title: "Passer à l’abonnement" };

const STEPS = [
  { key: "infos", label: "Informations" },
  { key: "pieces", label: "Pièces justificatives" },
  { key: "offre", label: "Offre et paiement" },
] as const;
type Step = (typeof STEPS)[number]["key"];

export default async function UpgradePage({ params, searchParams }: PageProps<"/ecole/[schoolId]/upgrade">) {
  const { schoolId } = await params;
  const { etape } = await searchParams;
  const [onboarding, plans] = await Promise.all([getOnboarding(schoolId), getPlans()]);
  const { school, requirements } = onboarding;
  const base = `/ecole/${school.id}`;
  if (school.subscriptionStatus !== "DISCOVERY") redirect(base);

  const p = upgradeProgress(onboarding);
  const done: Record<Step, boolean> = { infos: p.info, pieces: p.documents, offre: p.paid };
  const firstTodo = STEPS.find((s) => !done[s.key])?.key ?? "offre";
  const requested = STEPS.find((s) => s.key === etape)?.key;
  // On ne saute pas une étape obligatoire : l'offre n'est accessible qu'une fois infos et pièces complètes.
  const reachable = (s: Step) => s === "infos" || (s === "pieces" ? p.info : p.info && p.documents);
  const step: Step = requested && reachable(requested) ? requested : firstTodo;

  return (
    <>
      <PageHeader
        title="Passer à l’abonnement"
        description="Trois étapes. Vos informations sont enregistrées à chaque étape : vous pouvez revenir plus tard."
      />

      <nav aria-label="Étapes" className="mb-8">
        <ol className="grid gap-2 sm:grid-cols-3">
          {STEPS.map((s, i) => {
            const current = s.key === step;
            const ok = reachable(s.key);
            const content = (
              <>
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
                    done[s.key]
                      ? "bg-success text-white"
                      : current
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {done[s.key] ? <Check className="size-4" /> : i + 1}
                </span>
                <span className={cn("text-sm font-medium", !current && "text-muted-foreground")}>{s.label}</span>
              </>
            );
            const cls = cn(
              "flex items-center gap-3 rounded-lg border p-3",
              current && "border-primary/40 bg-accent/60",
            );
            return (
              <li key={s.key}>
                {ok && !current ? (
                  <Link href={`?etape=${s.key}`} className={cn(cls, "hover:bg-muted/60")}>
                    {content}
                  </Link>
                ) : (
                  <div className={cn(cls, !ok && "opacity-60")} aria-current={current ? "step" : undefined}>
                    {content}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {step === "infos" && <InfoForm school={school} nextHref={`${base}/upgrade?etape=pieces`} />}

      {step === "pieces" && (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Une photo nette prise au téléphone suffit. Nous les vérifions après votre paiement, sous 48 h ouvrées.
          </p>
          <DocumentList schoolId={school.id} requirements={requirements} verificationStatus={school.verificationStatus} />
          <div className="flex items-center justify-end gap-3">
            {!p.documents && (
              <p className="text-sm text-muted-foreground">
                {p.sent} sur {p.total} pièce(s) obligatoire(s) envoyée(s)
              </p>
            )}
            {p.documents ? (
              <Button asChild size="lg">
                <Link href="?etape=offre">
                  Choisir mon offre <ArrowRight aria-hidden />
                </Link>
              </Button>
            ) : (
              <Button size="lg" disabled>
                Choisir mon offre <ArrowRight aria-hidden />
              </Button>
            )}
          </div>
        </div>
      )}

      {step === "offre" && (
        <PlanPicker
          schoolId={school.id}
          plans={plans}
          devPayments={process.env.NODE_ENV !== "production" && Boolean(process.env.PAYMENT_WEBHOOK_SECRET)}
        />
      )}
    </>
  );
}
