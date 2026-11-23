"use client";

import { Camera, Trash2 } from "lucide-react";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { removePhoto, uploadPhoto, type PhotoKind } from "./actions";

const MAX = 2 * 1_048_576;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Boutons sur l'avatar : changer la photo (envoyée dès le choix) ou la retirer. */
export function PhotoEditor({
  schoolId,
  kind,
  id,
  hasPhoto,
}: {
  schoolId: string;
  kind: PhotoKind;
  id: string;
  hasPhoto: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  const send = (file: File) => {
    if (!TYPES.includes(file.type)) return toast.error("Choisissez une photo JPEG, PNG ou WebP.");
    if (file.size > MAX) return toast.error("Photo trop lourde : 2 Mo maximum.");
    const form = new FormData();
    form.set("file", file);
    start(async () => {
      const r = await uploadPhoto(schoolId, kind, id, form);
      if (r?.error) toast.error(r.error);
      else toast.success("Photo enregistrée.");
    });
  };

  return (
    <div className="absolute -right-1 -bottom-1 flex gap-1">
      <input
        ref={input}
        type="file"
        accept={TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) send(f);
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={pending}
        aria-label={hasPhoto ? "Changer la photo" : "Ajouter une photo"}
        className="grid size-8 place-items-center rounded-full border bg-background text-foreground shadow-sm hover:bg-muted disabled:opacity-50"
      >
        <Camera aria-hidden className="size-4" />
      </button>
      {hasPhoto && (
        <button
          type="button"
          onClick={() =>
            start(async () => {
              const r = await removePhoto(schoolId, kind, id);
              if (r?.error) toast.error(r.error);
            })
          }
          disabled={pending}
          aria-label="Retirer la photo"
          className="grid size-8 place-items-center rounded-full border bg-background text-destructive shadow-sm hover:bg-muted disabled:opacity-50"
        >
          <Trash2 aria-hidden className="size-4" />
        </button>
      )}
    </div>
  );
}
