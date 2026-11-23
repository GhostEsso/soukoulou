"use client";

import { Check, RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormMessage } from "@/components/form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setTheme } from "../actions";

const SOUKOULOU = "#2346c8";
const PRESETS = ["#2346c8", "#0f766e", "#15803d", "#b91c1c", "#9d174d", "#6d28d9", "#c2410c", "#334155"];
const HEX = /^#[0-9a-fA-F]{6}$/;

// Même calcul que l'API (rules.ts) : texte blanc sur la couleur, WCAG AA = 4,5.
function contrastWithWhite(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
}

export function ThemeForm({ schoolId, schoolName, current }: { schoolId: string; schoolName: string; current: string | null }) {
  const [color, setColor] = useState((current ?? SOUKOULOU).toLowerCase());
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const valid = HEX.test(color);
  const ratio = valid ? contrastWithWhite(color) : 0;
  const readable = ratio >= 4.5;
  const saved = (current ?? SOUKOULOU).toLowerCase();

  const save = (value: string | null) =>
    start(async () => {
      setError(undefined);
      const r = await setTheme(schoolId, value);
      if (r?.error) setError(r.error);
      else toast.success(r?.message);
    });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,24rem)]">
      <div className="space-y-6">
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">Couleurs proposées</legend>
          <div className="flex flex-wrap gap-3">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setColor(p)}
                aria-label={p === SOUKOULOU ? "Bleu Soukoulou" : p}
                aria-pressed={color === p}
                className="grid size-10 place-items-center rounded-full ring-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:ring-2 aria-pressed:ring-foreground"
                style={{ background: p }}
              >
                {color === p && <Check className="size-4 text-white" aria-hidden />}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-1.5">
          <label htmlFor="custom-color" className="text-sm font-semibold">
            Ou votre couleur
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={valid ? color : SOUKOULOU}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Sélecteur de couleur"
              className="h-10 w-14 cursor-pointer rounded-lg border bg-background p-1"
            />
            <input
              id="custom-color"
              value={color}
              onChange={(e) => setColor(e.target.value.trim().toLowerCase())}
              maxLength={7}
              spellCheck={false}
              className="h-10 w-32 rounded-lg border border-input px-3 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-describedby="contrast-hint"
            />
          </div>
          <p
            id="contrast-hint"
            className={cn("text-xs", valid && readable ? "text-muted-foreground" : "text-destructive")}
          >
            {!valid
              ? "Format attendu : #1a2b3c."
              : readable
                ? `Lisibilité du texte blanc : ${ratio.toFixed(1)} (minimum 4,5).`
                : `Trop claire : le texte blanc serait illisible (${ratio.toFixed(1)}, minimum 4,5). Choisissez une teinte plus foncée.`}
          </p>
        </div>

        {error && <FormMessage state={{ error }} />}

        <div className="flex flex-wrap gap-3">
          <Button disabled={pending || !valid || !readable || color === saved} onClick={() => save(color)}>
            Enregistrer la couleur
          </Button>
          {current && (
            <Button variant="outline" disabled={pending} onClick={() => save(null)}>
              <RotateCcw aria-hidden /> Revenir au bleu Soukoulou
            </Button>
          )}
        </div>
      </div>

      <div aria-label="Aperçu" className="overflow-hidden rounded-xl border bg-background shadow-sm">
        <p className="border-b px-4 py-2 text-xs font-medium text-muted-foreground">Aperçu</p>
        <div className="space-y-4 p-5" style={{ "--brand": valid ? color : SOUKOULOU } as React.CSSProperties}>
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-brand text-sm font-semibold text-white">
              {schoolName.charAt(0).toUpperCase()}
            </span>
            <span className="text-sm font-semibold">{schoolName}</span>
          </div>
          <div className="rounded-lg bg-[color-mix(in_oklab,var(--brand)_8%,white)] px-3 py-2 text-sm font-medium text-brand">
            Tableau de bord
          </div>
          <div className="space-y-1.5 px-3 text-sm text-muted-foreground">
            <p>Élèves</p>
            <p>Notes</p>
          </div>
          <button type="button" tabIndex={-1} className="w-full rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white">
            Publier les bulletins
          </button>
        </div>
      </div>
    </div>
  );
}
