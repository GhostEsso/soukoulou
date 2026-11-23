import { AlertTriangle, ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { COUNTRIES, dateTime, money, METHODS, OWNERSHIPS, SCHOOL_TYPES, SUBSCRIPTION, VERIFICATION } from "@/lib/format";
import type { VerificationDetail } from "@/lib/types";
import { Decision, DocumentReview } from "./review";

export const metadata: Metadata = { title: "Dossier" };

const EVENTS: Record<string, string> = {
  SIGNED_UP: "Inscription",
  UPGRADE_INFO_SAVED: "Informations enregistrées",
  DOCUMENT_UPLOADED: "Pièce envoyée",
  PAYMENT_RECEIVED: "Paiement reçu",
  DOCUMENT_ACCEPTED: "Pièce conforme",
  DOCUMENT_REJECTED: "Pièce refusée",
  CHANGES_REQUESTED: "Correction demandée",
  RESUBMITTED: "Dossier renvoyé",
  VERIFIED: "École vérifiée",
  REJECTED: "Dossier refusé",
  SUSPENDED: "Suspendue",
  REACTIVATED: "Réactivée",
};

export default async function VerificationPage({ params }: PageProps<"/admin/verifications/[schoolId]">) {
  const { schoolId } = await params;
  const detail = await api<VerificationDetail>(`/platform/verifications/${encodeURIComponent(schoolId)}`).catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const { school, duplicates } = detail;
  const admin = school.memberships[0];
  const reviewable = school.verificationStatus === "PENDING";
  const docs = school.documents;
  const allAccepted = docs.length > 0 && docs.every((d) => d.reviewStatus === "ACCEPTED");
  const missingMandatory = detail.requirements.filter((r) => r.isMandatory && !r.document);
  const anyRejected = docs.some((d) => d.reviewStatus === "REJECTED");
  const paid = school.payments.filter((p) => p.status === "PAID");

  const facts: [string, React.ReactNode][] = [
    ["Type", SCHOOL_TYPES[school.type]],
    ["Statut", school.ownership ? OWNERSHIPS[school.ownership] : "—"],
    ["Autorisation n°", school.authorizationNumber ?? "—"],
    ["Ville", `${school.city}, ${COUNTRIES[school.country] ?? school.country}`],
    ["Adresse", school.address ?? "—"],
    ["Téléphone", school.phone ?? "—"],
    ["Email", school.email ?? "—"],
    ["Élèves (déclaré)", school.approxStudentCount ?? "—"],
    ["Adresse web", school.slug ? `${school.slug}.soukoulou.com` : (school.desiredSlug ?? "—")],
    ["Offre", school.plan?.name ?? "—"],
  ];

  return (
    <>
      <Link href="/admin/verifications" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Vérifications
      </Link>
      <PageHeader
        title={school.name}
        description={
          <span className="flex flex-wrap gap-2">
            <StatusBadge tone={VERIFICATION[school.verificationStatus].tone}>{VERIFICATION[school.verificationStatus].label}</StatusBadge>
            <StatusBadge tone={SUBSCRIPTION[school.subscriptionStatus].tone}>{SUBSCRIPTION[school.subscriptionStatus].label}</StatusBadge>
          </span>
        }
      />

      {duplicates.length > 0 && (
        <div role="alert" className="mb-6 flex gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Écoles ressemblantes</p>
            <p className="text-muted-foreground">Même nom, téléphone ou numéro d’autorisation. Vérifiez qu’il ne s’agit pas d’un doublon :</p>
            <ul className="mt-1 list-inside list-disc">
              {duplicates.map((d) => (
                <li key={d.id}>
                  <Link href={`/admin/verifications/${d.id}`} className="underline">
                    {d.name}
                  </Link>{" "}
                  ({d.city}) · {VERIFICATION[d.verificationStatus].label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Pièces justificatives</h2>
            {missingMandatory.length > 0 && (
              <p className="text-sm text-destructive">
                Manquante(s) : {missingMandatory.map((r) => r.name).join(", ")}
              </p>
            )}
            {docs.map((d) => (
              <DocumentReview key={d.id} schoolId={school.id} doc={d} reviewable={reviewable} />
            ))}
          </section>

          {reviewable && (
            <Decision
              schoolId={school.id}
              canApprove={allAccepted && missingMandatory.length === 0}
              canRequestChanges={anyRejected || missingMandatory.length > 0}
            />
          )}
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Établissement</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2.5 text-sm">
                {facts.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="break-words">{v}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          {admin && (
            <Card>
              <CardHeader>
                <CardTitle>Responsable</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5 text-sm">
                <p className="font-medium">
                  {admin.user.firstName} {admin.user.lastName}
                </p>
                {admin.title && <p className="text-muted-foreground">{admin.title}</p>}
                <p className="break-all">{admin.user.email}</p>
                {admin.user.phone && <p>{admin.user.phone}</p>}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Paiements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {paid.length === 0 && <p className="text-muted-foreground">Aucun paiement reçu.</p>}
              {paid.map((p) => (
                <div key={p.id} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{METHODS[p.method]}</span>
                  <span className="font-medium tabular-nums">{money(p.amount, p.currency)}</span>
                </div>
              ))}
              {paid.length > 0 && (
                <p className="text-xs text-muted-foreground">Un refus pour fraude n’est pas remboursé.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historique</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 border-l pl-4 text-sm">
                {school.events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-border" aria-hidden />
                    <p className="font-medium">{EVENTS[e.action] ?? e.action}</p>
                    {e.message && <p className="text-muted-foreground">{e.message}</p>}
                    <p className="text-xs text-muted-foreground">{dateTime(e.createdAt)}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
