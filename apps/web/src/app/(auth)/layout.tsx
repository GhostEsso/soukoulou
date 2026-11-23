import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/logo";

const POINTS = [
  "Chaque école définit ses propres règles de calcul de moyenne",
  "Bulletins, discipline et frais de scolarité au même endroit",
  "Les parents suivent leurs enfants depuis leur téléphone",
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(420px,520px)]">
      <main className="flex flex-col px-4 py-8 sm:px-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Soukoulou</p>
      </main>

      <aside className="relative hidden overflow-hidden bg-primary p-10 text-primary-foreground lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:justify-end lg:self-start">
        <div
          aria-hidden
          className="absolute -top-24 -right-24 size-96 rounded-full bg-white/10 blur-2xl"
        />
        <div aria-hidden className="absolute top-1/3 -left-16 size-64 rounded-full bg-white/5" />
        <div className="relative space-y-6">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight">
            La gestion scolaire, simple pour chaque école.
          </h2>
          <ul className="space-y-3">
            {POINTS.map((p) => (
              <li key={p} className="flex gap-3 text-[15px] text-white/90">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
