import { Megaphone } from "lucide-react";
import { dateTime } from "@/lib/format";
import type { Announcement } from "@/lib/types";

/** Annonces de l'école dans un espace enseignant, parent ou élève. */
export function AnnouncementFeed({ items }: { items: Announcement[] }) {
  return (
    <section id="annonces" className="scroll-mt-20 rounded-2xl border bg-card p-5" aria-label="Annonces">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
        <Megaphone aria-hidden className="size-4 text-primary" /> Annonces de l’école
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune annonce pour l’instant.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id} className="rounded-xl bg-muted/50 p-4">
              <p className="text-sm font-medium">{a.title}</p>
              <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{a.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">{dateTime(a.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Les annonces récentes dans la cloche de l'en-tête (lien vers le fil de l'accueil). */
export const feedNotices = (items: Announcement[], href: string) =>
  items.slice(0, 5).map((a) => ({
    id: a.id,
    title: a.title,
    detail: a.body.length > 90 ? `${a.body.slice(0, 90)}…` : a.body,
    time: dateTime(a.createdAt),
    href: `${href}#annonces`,
  }));
