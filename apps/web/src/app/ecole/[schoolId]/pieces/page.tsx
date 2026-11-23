import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { getOnboarding } from "@/lib/data";
import { VERIFICATION } from "@/lib/format";
import { DocumentList } from "../document-list";
import { ResubmitButton } from "./resubmit-button";

export const metadata: Metadata = { title: "Pièces justificatives" };

export default async function DocumentsPage({ params }: PageProps<"/ecole/[schoolId]/pieces">) {
  const { schoolId } = await params;
  const { school, requirements } = await getOnboarding(schoolId);
  const v = VERIFICATION[school.verificationStatus];
  const changes = school.verificationStatus === "CHANGES_REQUESTED";
  const ready =
    changes &&
    requirements.every((r) => (!r.isMandatory || r.document) && r.document?.reviewStatus !== "REJECTED");

  return (
    <>
      <PageHeader
        title="Pièces justificatives"
        description="Elles prouvent que votre école est autorisée. Elles restent privées : seuls vous et l’équipe Soukoulou y avez accès."
        actions={<StatusBadge tone={v.tone}>{v.label}</StatusBadge>}
      />
      {changes && (
        <div className="mb-4 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm">
          <p className="font-semibold">Des corrections sont demandées</p>
          <p className="mt-1 text-muted-foreground">
            Remplacez les pièces marquées « À remplacer », puis renvoyez le dossier. Les pièces conformes restent
            validées.
          </p>
        </div>
      )}
      {school.verificationStatus === "PENDING" && (
        <p className="mb-4 rounded-xl border bg-accent/50 p-4 text-sm text-muted-foreground">
          Votre dossier est en cours d’examen. Les pièces ne peuvent pas être modifiées pendant la vérification.
        </p>
      )}
      <DocumentList schoolId={school.id} requirements={requirements} verificationStatus={school.verificationStatus} />
      {changes && (
        <div className="mt-6 flex justify-end">
          <ResubmitButton schoolId={school.id} ready={ready} />
        </div>
      )}
    </>
  );
}
