"use client";

import { Copy, KeyRound } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { SchoolAccount } from "@/lib/types";
import { removeAccess, grantAccess, type AccessState, type AccountKind } from "./actions";
import { ActionButton } from "./dialogs";

const INTRO = {
  teachers: "Pas encore d’accès. Il se connectera avec son numéro de téléphone pour faire l’appel et saisir ses notes.",
  parents: "Pas encore d’accès. Il se connectera avec son numéro de téléphone pour suivre les notes et les absences de ses enfants.",
  students: "Pas encore d’accès. L’élève se connectera avec son matricule pour voir ses notes, ses absences et son emploi du temps.",
};

/**
 * Accès de l'enseignant, du parent ou de l'élève à son espace : identifiant = son téléphone, code de première connexion
 * montré une seule fois ici (l'école le lui transmet), valable 7 jours.
 */
export function AccessPanel({
  schoolId,
  kind,
  id,
  name,
  phone,
  account,
  readOnly,
}: {
  schoolId: string;
  kind: AccountKind;
  id: string;
  name: string;
  phone: string | null;
  account: SchoolAccount | null;
  readOnly: boolean;
}) {
  const [result, setResult] = useState<AccessState>();
  const [pending, start] = useTransition();
  const run = (mode: "create" | "reset") => start(async () => setResult(await grantAccess(schoolId, kind, id, mode)));

  return (
    <div className="space-y-3 text-sm">
      {account ? (
        <p>
          Se connecte avec <span className="font-medium tabular-nums">{account.phone}</span>
          <span className="block text-muted-foreground">
            {account.pending ? "N’a pas encore choisi son mot de passe." : "Mot de passe personnel choisi."}
          </span>
        </p>
      ) : (
        <p className="text-muted-foreground">
          {phone ? INTRO[kind] : kind === "students" ? "Renseignez son matricule (bouton « Modifier ») : ce sera son identifiant." : "Renseignez son téléphone (bouton « Modifier ») : ce sera son identifiant."}
        </p>
      )}

      {result?.error && <p className="text-destructive" role="alert">{result.error}</p>}
      {result?.code && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3" role="status">
          <p className="text-xs text-muted-foreground">Code de première connexion (affiché une seule fois, valable 7 jours)</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <code className="text-lg font-semibold tracking-widest">{result.code}</code>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Copier le code"
              onClick={() => navigator.clipboard.writeText(result.code!).then(() => toast.success("Code copié."))}
            >
              <Copy aria-hidden />
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Transmettez-le à {name} avec son identifiant {result.phone}. Le mot de passe personnel se choisit à la première connexion.
          </p>
        </div>
      )}
      {result && !result.error && !result.code && (
        <p role="status">Compte Soukoulou existant rattaché : il se connecte avec son mot de passe habituel.</p>
      )}

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          {!account && phone && (
            <Button onClick={() => run("create")} disabled={pending}>
              <KeyRound aria-hidden /> Créer l’accès
            </Button>
          )}
          {account && (
            <>
              <Button variant="outline" onClick={() => run("reset")} disabled={pending}>
                <KeyRound aria-hidden /> Nouveau code
              </Button>
              {/* Réversible (on recrée l'accès) : pas de confirmation. */}
              <ActionButton
                size="default"
                variant="ghost"
                pendingLabel="Retrait…"
                action={async (prev) => {
                  const r = await removeAccess(schoolId, kind, id, prev);
                  if (r?.ok) setResult(undefined);
                  return r;
                }}
              >
                Retirer l’accès
              </ActionButton>
            </>
          )}
        </div>
      )}
    </div>
  );
}
