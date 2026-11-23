import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";
import type { Plan } from "@/lib/types";
import { PlanForm } from "./plan-form";

export const metadata: Metadata = { title: "Offres" };

export default async function PlansPage() {
  const plans = await api<Plan[]>("/platform/plans");
  return (
    <>
      <PageHeader
        title="Offres"
        description="Les changements s’appliquent aux prochains paiements. Les périodes déjà payées ne changent pas."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => (
          <PlanForm key={p.id} plan={p} />
        ))}
      </div>
    </>
  );
}
