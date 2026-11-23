import type { Metadata } from "next";
import { getMe } from "@/lib/data";
import { ChooseForm } from "./choose-form";

export const metadata: Metadata = { title: "Choisir un mot de passe" };

/** Après une connexion avec le code remis par l'école : on choisit son propre mot de passe. */
export default async function ChoosePasswordPage() {
  const me = await getMe();
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {me.mustChangePassword ? `Bienvenue ${me.firstName}` : "Changer de mot de passe"}
        </h1>
        {me.mustChangePassword && (
          <p className="text-sm text-muted-foreground">
            Remplacez le code reçu de l’école par un mot de passe que vous seul connaissez.
          </p>
        )}
      </div>
      <ChooseForm first={me.mustChangePassword} />
    </div>
  );
}
