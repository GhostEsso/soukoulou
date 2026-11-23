"use client";

import { Check, ExternalLink, X } from "lucide-react";
import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { dateTime, REVIEW } from "@/lib/format";
import type { VerificationDetail } from "@/lib/types";
import { approve, reject, requestChanges, reviewDocument } from "../../actions";

type Doc = VerificationDetail["school"]["documents"][number];

export function DocumentReview({ schoolId, doc, reviewable }: { schoolId: string; doc: Doc; reviewable: boolean }) {
  const [state, action] = useActionState(reviewDocument.bind(null, schoolId, doc.id), undefined);
  const [checked, setChecked] = useState<boolean[]>(doc.requirement.checkpoints.map(() => false));
  const [refusing, setRefusing] = useState(Boolean(state?.values?.comment));
  const pending = doc.reviewStatus === "PENDING";
  const isImage = doc.mimeType.startsWith("image/");
  const href = `/fichiers/${schoolId}/${doc.id}`;
  const allChecked = checked.every(Boolean);

  return (
    <article className="overflow-hidden rounded-xl border">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <h3 className="font-medium">{doc.requirement.name}</h3>
        <StatusBadge tone={REVIEW[doc.reviewStatus].tone}>{REVIEW[doc.reviewStatus].label}</StatusBadge>
        <a href={href} target="_blank" rel="noopener" className="ml-auto inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          Ouvrir <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </header>

      <div className="grid md:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="bg-muted/50">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- fichier privé servi par notre route, pas d'optimisation voulue
            <img src={href} alt={doc.requirement.name} className="max-h-[28rem] w-full object-contain" />
          ) : (
            <iframe src={href} title={doc.requirement.name} className="h-[28rem] w-full" />
          )}
        </div>

        <div className="space-y-4 p-4">
          <p className="text-xs text-muted-foreground">
            {doc.originalName} · {dateTime(doc.uploadedAt)}
          </p>
          {doc.reviewComment && <p className="rounded-md bg-muted px-2.5 py-1.5 text-sm">Motif : {doc.reviewComment}</p>}

          {reviewable && pending && (
            <form action={action} className="space-y-4">
              {doc.requirement.checkpoints.length > 0 && (
                <fieldset className="space-y-2">
                  <legend className="mb-1 text-sm font-semibold">À vérifier</legend>
                  {doc.requirement.checkpoints.map((c, i) => (
                    <div key={c} className="flex items-start gap-2">
                      <Checkbox
                        id={`${doc.id}-${i}`}
                        checked={checked[i]}
                        onCheckedChange={(v) => setChecked((prev) => prev.map((x, j) => (j === i ? v === true : x)))}
                      />
                      <Label htmlFor={`${doc.id}-${i}`} className="text-sm leading-snug font-normal">
                        {c}
                      </Label>
                    </div>
                  ))}
                </fieldset>
              )}

              <FormMessage state={state} />

              {refusing ? (
                <div className="space-y-2">
                  <Label htmlFor={`${doc.id}-comment`}>Ce que l’école doit corriger</Label>
                  <Textarea
                    id={`${doc.id}-comment`}
                    name="comment"
                    required
                    minLength={3}
                    maxLength={500}
                    defaultValue={state?.values?.comment}
                    placeholder="Ex. : photo floue, cachet illisible."
                  />
                  <div className="flex gap-2">
                    <SubmitButton name="status" value="REJECTED" variant="destructive" pendingLabel="Envoi…">
                      Refuser la pièce
                    </SubmitButton>
                    <Button type="button" variant="ghost" onClick={() => setRefusing(false)}>
                      Annuler
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <SubmitButton name="status" value="ACCEPTED" pendingLabel="Envoi…" disabled={!allChecked}>
                    <Check aria-hidden /> Conforme
                  </SubmitButton>
                  <Button type="button" variant="outline" onClick={() => setRefusing(true)}>
                    <X aria-hidden /> Non conforme
                  </Button>
                </div>
              )}
              {!allChecked && !refusing && <p className="text-xs text-muted-foreground">Cochez chaque point pour valider.</p>}
            </form>
          )}
        </div>
      </div>
    </article>
  );
}

export function Decision({
  schoolId,
  canApprove,
  canRequestChanges,
}: {
  schoolId: string;
  canApprove: boolean;
  canRequestChanges: boolean;
}) {
  const [approveState, approveAction] = useActionState(approve.bind(null, schoolId), undefined);
  const [changesState, changesAction] = useActionState(requestChanges.bind(null, schoolId), undefined);
  const [rejectState, rejectAction] = useActionState(reject.bind(null, schoolId), undefined);
  const [rejecting, setRejecting] = useState(false);

  return (
    <section className="space-y-4 rounded-xl border p-5">
      <h2 className="text-lg font-semibold">Décision</h2>

      {canApprove && (
        <form action={approveAction} className="space-y-2">
          <FormMessage state={approveState} />
          <p className="text-sm text-muted-foreground">Toutes les pièces sont conformes.</p>
          <SubmitButton pendingLabel="Validation…">
            <Check aria-hidden /> Valider l’école
          </SubmitButton>
        </form>
      )}

      {canRequestChanges && (
        <form action={changesAction} className="space-y-2">
          <FormMessage state={changesState} />
          <Label htmlFor="changes-message">Message à l’école</Label>
          <Textarea
            id="changes-message"
            name="message"
            required
            minLength={3}
            maxLength={1000}
            defaultValue={changesState?.values?.message ?? "Merci de remplacer les pièces signalées. Le motif est indiqué sous chaque pièce."}
          />
          <SubmitButton pendingLabel="Envoi…">Demander les corrections</SubmitButton>
        </form>
      )}

      {!canApprove && !canRequestChanges && (
        <p className="text-sm text-muted-foreground">Examinez chaque pièce pour pouvoir décider.</p>
      )}

      <div className="border-t pt-4">
        {rejecting ? (
          <form action={rejectAction} className="space-y-2">
            <FormMessage state={rejectState} />
            <Label htmlFor="reject-reason">Motif du refus définitif</Label>
            <Textarea id="reject-reason" name="reason" required minLength={3} maxLength={500} defaultValue={rejectState?.values?.reason} />
            <p className="text-xs text-muted-foreground">
              Réservé aux fraudes. L’école est bloquée et le paiement n’est pas remboursé. Irréversible depuis la console.
            </p>
            <div className="flex gap-2">
              <SubmitButton variant="destructive" pendingLabel="Refus…">
                Refuser définitivement
              </SubmitButton>
              <Button type="button" variant="ghost" onClick={() => setRejecting(false)}>
                Annuler
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setRejecting(true)}>
            Refuser pour fraude…
          </Button>
        )}
      </div>
    </section>
  );
}
