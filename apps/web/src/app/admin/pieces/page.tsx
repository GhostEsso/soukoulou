import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/api";
import { COUNTRIES, date, OWNERSHIPS, SCHOOL_TYPES } from "@/lib/format";
import type { DocumentRequirement } from "@/lib/types";
import { RequirementForm, ToggleRequirement } from "./requirement-form";

export const metadata: Metadata = { title: "Pièces demandées" };

const scope = (values: string[], labels: Record<string, string>, all: string) =>
  values.length ? values.map((v) => labels[v] ?? v).join(", ") : all;

export default async function RequirementsPage() {
  const reqs = await api<DocumentRequirement[]>("/platform/document-requirements");
  return (
    <>
      <PageHeader
        title="Pièces demandées"
        description="Ce que chaque école doit fournir. Une pièce s’affiche dans le tableau de bord des écoles concernées."
      />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <ul className="space-y-3">
          {reqs.map((r) => (
            <li key={r.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.name}</p>
                  {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
                </div>
                <StatusBadge tone={r.isActive ? "success" : "neutral"}>{r.isActive ? "Active" : "Désactivée"}</StatusBadge>
                <StatusBadge tone="neutral">{r.isMandatory ? "Obligatoire" : "Facultative"}</StatusBadge>
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Pays</dt>
                  <dd>{scope(r.countries, COUNTRIES, "Tous")}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Types</dt>
                  <dd>{scope(r.schoolTypes, SCHOOL_TYPES, "Tous")}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Statuts</dt>
                  <dd>{scope(r.ownerships, OWNERSHIPS, "Tous")}</dd>
                </div>
              </dl>
              {r.appliesToExisting && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Demandée aussi aux écoles déjà inscrites, avant le {date(r.dueDate)}.
                </p>
              )}
              {r.checkpoints.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                  {r.checkpoints.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )}
              <div className="mt-3">
                <ToggleRequirement id={r.id} isActive={r.isActive} />
              </div>
            </li>
          ))}
        </ul>
        <RequirementForm />
      </div>
    </>
  );
}
