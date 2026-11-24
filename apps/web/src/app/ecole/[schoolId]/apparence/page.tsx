import { Palette } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getOnboarding } from "@/lib/data";
import { logoUrl } from "@/lib/format";
import { LogoForm } from "./logo-form";
import { ThemeForm } from "./theme-form";

export const metadata: Metadata = { title: "Apparence" };

export default async function AppearancePage({ params }: PageProps<"/ecole/[schoolId]/apparence">) {
  const { schoolId } = await params;
  const { school } = await getOnboarding(schoolId);
  const allowed = school.plan?.features.includes("custom_theme") ?? false;

  return (
    <>
      <PageHeader
        title="Apparence"
        description="Le logo de votre école et, avec Premium, sa couleur d’accent : boutons, menu, liens."
      />
      <LogoForm schoolId={school.id} schoolName={school.name} logo={logoUrl(school.id, school.logo)} />
      {allowed ? (
        <ThemeForm schoolId={school.id} schoolName={school.name} current={school.brandColor} />
      ) : (
        <EmptyState
          icon={<Palette className="size-5" aria-hidden />}
          title="Couleur personnalisée : offre Premium"
          description="Avec Premium, votre école associe le blanc à sa propre couleur. Les autres offres utilisent le bleu Soukoulou."
          action={
            <Button asChild variant="outline">
              <Link href={`/ecole/${school.id}/abonnement`}>Voir mon abonnement</Link>
            </Button>
          }
        />
      )}
    </>
  );
}
