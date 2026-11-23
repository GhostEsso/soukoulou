import { Lock, Network } from "lucide-react";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DENIALS } from "@/lib/api";
import { getOnboarding } from "@/lib/data";

/** Scolarité : réservée aux écoles abonnées ; lecture seule si l'écriture est bloquée. */
export default async function ScolariteLayout({ children, params }: LayoutProps<"/ecole/[schoolId]">) {
  const { schoolId } = await params;
  const denial = (await getOnboarding(schoolId)).access.write;

  if (denial === "DISCOVERY") {
    return (
      <>
        <PageHeader title="Scolarité" />
        <EmptyState
          icon={<Network className="size-5" aria-hidden />}
          title="Disponible après l’upgrade"
          description="Années scolaires, niveaux, matières, coefficients et classes se configurent une fois l’abonnement souscrit. Explorez l’école de démo en attendant."
          action={
            <Button asChild>
              <Link href={`/ecole/${schoolId}/upgrade`}>Passer à l’abonnement</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      {denial && (
        <Alert className="mb-6">
          <Lock aria-hidden />
          <AlertTitle>Lecture seule</AlertTitle>
          <AlertDescription>{DENIALS[denial] ?? "Modification indisponible pour le moment."}</AlertDescription>
        </Alert>
      )}
      {children}
    </>
  );
}
