"use client";

import { Eye, FileText, Loader2, Upload } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { FormMessage } from "@/components/form";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { date, REVIEW } from "@/lib/format";
import type { RequirementStatus, VerificationStatus } from "@/lib/types";
import { uploadDocument } from "./actions";

/**
 * Pièces demandées à l'école. Une pièce peut être envoyée tant que le dossier est modifiable,
 * ou si elle est nouvelle pour une école déjà vérifiée. Une pièce conforme n'est plus remplaçable.
 */
export function DocumentList({
  schoolId,
  requirements,
  verificationStatus,
}: {
  schoolId: string;
  requirements: RequirementStatus[];
  verificationStatus: VerificationStatus;
}) {
  const editable = verificationStatus === "NOT_SUBMITTED" || verificationStatus === "CHANGES_REQUESTED";
  return (
    <ul className="divide-y rounded-xl border">
      {requirements.map((r) => {
        const doc = r.document;
        const canUpload =
          doc?.reviewStatus !== "ACCEPTED" &&
          (verificationStatus === "CHANGES_REQUESTED"
            ? !doc || doc.reviewStatus === "REJECTED"
            : editable || (verificationStatus === "VERIFIED" && !doc));
        return (
          <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
              <FileText className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{r.name}</p>
                {!r.isMandatory && <span className="text-xs text-muted-foreground">Facultative</span>}
                {doc && <StatusBadge tone={REVIEW[doc.reviewStatus].tone}>{REVIEW[doc.reviewStatus].label}</StatusBadge>}
                {r.overdue && <StatusBadge tone="danger">En retard</StatusBadge>}
              </div>
              {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
              {r.dueDate && !doc && <p className="text-xs text-muted-foreground">À envoyer avant le {date(r.dueDate)}</p>}
              {doc?.reviewStatus === "REJECTED" && doc.reviewComment && (
                <p className="rounded-md bg-destructive/5 px-2.5 py-1.5 text-sm text-destructive">
                  Motif : {doc.reviewComment}
                </p>
              )}
              {doc && (
                <a
                  href={`/fichiers/${schoolId}/${doc.id}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex max-w-full items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Eye className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{doc.originalName}</span>
                  <span className="shrink-0">· envoyée le {date(doc.uploadedAt)}</span>
                </a>
              )}
            </div>
            {canUpload && <UploadForm schoolId={schoolId} requirement={r} replace={Boolean(doc)} />}
          </li>
        );
      })}
    </ul>
  );
}

function UploadForm({
  schoolId,
  requirement,
  replace,
}: {
  schoolId: string;
  requirement: RequirementStatus;
  replace: boolean;
}) {
  const [state, action, pending] = useActionState(uploadDocument.bind(null, schoolId, requirement.id), undefined);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [tooBig, setTooBig] = useState(false);
  const maxMb = Math.round(requirement.maxSizeBytes / 1_048_576);

  return (
    <form ref={form} action={action} className="flex shrink-0 flex-col items-stretch gap-2 sm:w-52 sm:items-end">
      <input
        ref={input}
        type="file"
        name="file"
        accept={requirement.acceptedMimeTypes.join(",")}
        className="sr-only"
        aria-label={`Fichier pour : ${requirement.name}`}
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          setTooBig(Boolean(f && f.size > requirement.maxSizeBytes));
          if (f && f.size > requirement.maxSizeBytes) {
            e.currentTarget.value = "";
            return;
          }
          if (f) form.current?.requestSubmit();
        }}
      />
      <Button
        type="button"
        variant={replace ? "outline" : "default"}
        disabled={pending}
        onClick={() => input.current?.click()}
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
        {pending ? "Envoi…" : replace ? "Remplacer" : "Envoyer"}
      </Button>
      <p className="text-xs text-muted-foreground sm:text-right">PDF, JPG ou PNG · {maxMb} Mo max.</p>
      {tooBig ? (
        <FormMessage state={{ error: `Fichier trop lourd : ${maxMb} Mo maximum.` }} />
      ) : (
        state?.error && <FormMessage state={state} />
      )}
    </form>
  );
}
