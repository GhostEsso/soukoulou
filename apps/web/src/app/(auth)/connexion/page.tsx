import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: PageProps<"/connexion">) {
  const { suite, reinitialise } = await searchParams;
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Connexion</h1>
        <p className="text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link href="/inscription" className="font-medium text-primary hover:underline">
            Inscrivez votre école
          </Link>
        </p>
      </div>
      <LoginForm
        next={typeof suite === "string" ? suite : "/espace"}
        notice={reinitialise ? "Mot de passe modifié. Connectez-vous avec le nouveau." : undefined}
      />
    </div>
  );
}
