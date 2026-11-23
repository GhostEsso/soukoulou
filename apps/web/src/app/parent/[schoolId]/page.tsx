import type { Metadata } from "next";
import Link from "next/link";
import { AnnouncementFeed } from "@/components/announcement-feed";
import { getFeed, getParentHome } from "@/lib/data";
import { RELATIONS } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Accueil" };

export default async function ParentHomePage({ params }: PageProps<"/parent/[schoolId]">) {
  const { schoolId } = await params;
  const [home, feed] = await Promise.all([getParentHome(schoolId), getFeed(schoolId)]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Bonjour {home.firstName}</h1>
      {home.children.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aucun enfant n’est encore rattaché à votre fiche : contactez l’école.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {home.children.map((c) => (
            <li key={c.id}>
              <Link
                href={`/parent/${schoolId}/enfants/${c.id}`}
                className={cn(
                  "flex items-center gap-4 rounded-2xl p-5 transition-colors",
                  c.sex === "FEMALE"
                    ? "bg-amber-100 hover:bg-amber-200/70 dark:bg-amber-500/15"
                    : "bg-sky-100 hover:bg-sky-200/70 dark:bg-sky-500/15",
                )}
              >
                <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full bg-white/70 text-lg font-semibold dark:bg-white/10">
                  {c.firstName[0]}
                  {c.lastName[0]}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {c.firstName} {c.lastName}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {c.classroom ? c.classroom.name : "Non inscrit cette année"} · {RELATIONS[c.relation]}
                  </span>
                  <span className="mt-1 block text-sm font-medium text-primary">Notes, absences, emploi du temps</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <AnnouncementFeed items={feed} />
    </div>
  );
}
