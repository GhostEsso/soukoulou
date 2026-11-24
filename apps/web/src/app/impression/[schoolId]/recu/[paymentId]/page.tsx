import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { FEE_METHODS, money } from "@/lib/format";
import type { FeeReceipt } from "@/lib/types";
import { PrintButton } from "../../bulletins/print-button";

export const metadata: Metadata = { title: "Reçu" };

/**
 * Reçu de paiement des frais de scolarité, une page A5 paysage, à imprimer ou enregistrer en PDF.
 * `?enfant=<id>` : ouvert depuis l'espace parent (l'API vérifie que l'enfant est le sien).
 */
export default async function PrintReceipt({ params, searchParams }: PageProps<"/impression/[schoolId]/recu/[paymentId]">) {
  const { schoolId, paymentId } = await params;
  const child = (await searchParams).enfant;
  const s = encodeURIComponent(schoolId);
  const p = encodeURIComponent(paymentId);
  const url =
    typeof child === "string"
      ? `/schools/${s}/parent/children/${encodeURIComponent(child)}/fees/receipts/${p}`
      : `/schools/${s}/fees/payments/${p}/receipt`;
  const r = await api<FeeReceipt>(url).catch((e) => {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  });

  return (
    <div className="min-h-screen bg-neutral-100 py-6 text-neutral-900 print:bg-white print:py-0">
      <style>{`@page { size: A5 landscape; margin: 10mm; } @media print { html, body { background: #fff !important; } }`}</style>
      <div className="mx-auto mb-6 flex max-w-[190mm] flex-wrap items-center justify-between gap-3 px-4 print:hidden">
        <p className="text-sm text-neutral-600">Reçu {r.number}</p>
        <PrintButton />
      </div>
      <article className="mx-auto max-w-[190mm] bg-white p-[8mm] text-sm leading-relaxed shadow print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b-2 border-neutral-900 pb-3">
          <p className="text-base font-bold uppercase">{r.school.name}</p>
          <div className="text-right">
            <p className="text-base font-bold tracking-wide uppercase">Reçu de paiement</p>
            <p className="font-mono">{r.number}</p>
          </div>
        </header>
        <dl className="my-4 grid grid-cols-[10rem_1fr] gap-y-1.5">
          <dt className="text-neutral-600">Date et heure</dt>
          <dd>
            {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Lome" }).format(new Date(r.paidAt))}
          </dd>
          <dt className="text-neutral-600">{r.payerRole === "cashier" ? "Encaissé par" : "Payé par"}</dt>
          <dd>{r.payer ?? "—"}</dd>
          <dt className="text-neutral-600">Élève</dt>
          <dd className="font-semibold">{r.student.name}</dd>
          <dt className="text-neutral-600">Classe</dt>
          <dd>{r.classroom ?? "—"}</dd>
          <dt className="text-neutral-600">Objet</dt>
          <dd>Frais de scolarité</dd>
          <dt className="text-neutral-600">Mode de paiement</dt>
          <dd>{FEE_METHODS[r.method]}</dd>
        </dl>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded border-2 border-neutral-900 p-3">
            <p className="text-[10px] uppercase">Montant reçu</p>
            <p className="text-xl font-bold tabular-nums">{money(r.amount)}</p>
          </div>
          <div className="rounded border border-neutral-400 p-3">
            <p className="text-[10px] uppercase">Reste à payer après ce paiement (sur {money(r.due)})</p>
            <p className="text-xl font-semibold tabular-nums">{money(r.remaining)}</p>
          </div>
        </div>
        <p className="mt-8 text-right text-[10px] text-neutral-500">Signature et cachet de l’établissement</p>
      </article>
    </div>
  );
}
