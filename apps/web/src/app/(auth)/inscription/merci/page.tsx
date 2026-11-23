import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Vérifiez votre email" };

export default async function ThanksPage({ searchParams }: PageProps<"/inscription/merci">) {
  const { email } = await searchParams;
  return (
    <div className="space-y-6">
      <div className="grid size-12 place-items-center rounded-xl bg-accent text-primary">
        <MailCheck className="size-6" aria-hidden />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Vérifiez votre boîte email</h1>
        <p className="text-sm text-muted-foreground">
          Nous avons envoyé un lien de confirmation à{" "}
          <span className="font-medium text-foreground">{typeof email === "string" ? email : "votre adresse"}</span>.
          Cliquez dessus pour commencer votre découverte de 15 jours.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        Rien reçu après quelques minutes ? Regardez dans les courriers indésirables, ou{" "}
        <Link href="/inscription" className="font-medium text-primary hover:underline">
          vérifiez l’adresse saisie
        </Link>
        .
      </p>
    </div>
  );
}
