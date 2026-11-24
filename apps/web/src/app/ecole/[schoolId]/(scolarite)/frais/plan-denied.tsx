import { Lock } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { DENIALS } from "@/lib/api";

/** Page entière indisponible dans l'offre de l'école. */
export function PlanDenied({ schoolId, title }: { schoolId: string; title: string }) {
  return (
    <EmptyState
      icon={<Lock className="size-5" aria-hidden />}
      title={title}
      description={DENIALS.PLAN}
      action={
        <Button asChild variant="outline">
          <Link href={`/ecole/${schoolId}/abonnement`}>Voir les offres</Link>
        </Button>
      }
    />
  );
}
