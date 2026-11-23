import type { Metadata } from "next";
import Link from "next/link";
import { TokenForm } from "./token-form";

export const metadata: Metadata = { title: "Confirmer mon email" };

/**
 * Confirmation par bouton et non à l'ouverture du lien :
 * certains antivirus d'email ouvrent les liens et consommeraient le jeton à la place de l'utilisateur.
 */
export default async function VerifyEmailPage({ searchParams }: PageProps<"/verifier-email">) {
  const { token } = await searchParams;
  if (typeof token !== "string" || !token) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Lien incomplet</h1>
        <p className="text-sm text-muted-foreground">
          Ouvrez le lien reçu par email en entier, ou{" "}
          <Link href="/connexion" className="font-medium text-primary hover:underline">
            connectez-vous
          </Link>
          .
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Confirmer votre email</h1>
        <p className="text-sm text-muted-foreground">
          Un dernier clic, et votre découverte de Soukoulou commence.
        </p>
      </div>
      <TokenForm token={token} />
    </div>
  );
}
