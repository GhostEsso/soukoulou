import type { Metadata } from "next";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Hors ligne" };

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="flex max-w-sm flex-col items-center gap-4">
        <Logo />
        <h1 className="text-2xl font-semibold">Vous êtes hors ligne</h1>
        <p className="text-muted-foreground">
          Cette page n’a pas encore été consultée avec du réseau. Vérifiez votre connexion internet, puis réessayez.
        </p>
        <a href="/espace" className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground">
          Réessayer
        </a>
      </div>
    </main>
  );
}
