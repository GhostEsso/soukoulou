import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Inscrire mon école" };

export default function SignupPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Inscrire mon école</h1>
        <p className="text-sm text-muted-foreground">
          Gratuit pendant 15 jours en mode découverte, sans carte ni document. Déjà inscrit ?{" "}
          <Link href="/connexion" className="font-medium text-primary hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
      <SignupForm />
    </div>
  );
}
