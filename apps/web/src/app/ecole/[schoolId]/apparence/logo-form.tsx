"use client";

import { ImageUp, Trash2 } from "lucide-react";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeLogo, uploadLogo } from "../actions";

const MAX = 2 * 1_048_576;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Logo de l'école : envoyé dès le choix du fichier. */
export function LogoForm({ schoolId, schoolName, logo }: { schoolId: string; schoolName: string; logo: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const done = (r: { error?: string; message?: string } | undefined) => {
    if (r?.error) toast.error(r.error);
    else toast.success(r?.message);
  };

  const send = (file: File) => {
    if (!TYPES.includes(file.type)) return toast.error("Choisissez une image JPEG, PNG ou WebP.");
    if (file.size > MAX) return toast.error("Image trop lourde : 2 Mo maximum.");
    const form = new FormData();
    form.set("file", file);
    start(async () => done(await uploadLogo(schoolId, form)));
  };

  return (
    <section className="flex flex-wrap items-center gap-5 rounded-xl border p-5">
      <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- image privée relayée, pas d'optimisation
          <img src={logo} alt={`Logo de ${schoolName}`} className="size-full object-contain" />
        ) : (
          <ImageUp className="size-6 text-muted-foreground" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <h2 className="text-sm font-semibold">Logo de l’école</h2>
        <p className="text-sm text-muted-foreground">
          Affiché en haut du menu pour l’équipe, les enseignants, les parents et les élèves. JPEG, PNG ou WebP, 2 Mo maximum.
        </p>
      </div>
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
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => input.current?.click()}>
          <ImageUp aria-hidden /> {logo ? "Changer le logo" : "Choisir un logo"}
        </Button>
        {logo && (
          <Button variant="outline" disabled={pending} onClick={() => start(async () => done(await removeLogo(schoolId)))}>
            <Trash2 aria-hidden /> Retirer
          </Button>
        )}
      </div>
    </section>
  );
}
