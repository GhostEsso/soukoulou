import type { Metadata } from "next";
import { api } from "@/lib/api";
import { AUDIENCES, dateTime } from "@/lib/format";
import type { Announcement } from "@/lib/types";
import { DeleteButton } from "../dialogs";
import { ListCard, readOnlyOf } from "../list";
import { AddAnnouncement } from "./announcement-actions";

export const metadata: Metadata = { title: "Annonces" };

/** Annonces publiées par l'administration, visibles dans les espaces enseignant, parent ou élève. */
export default async function AnnouncementsPage({ params }: PageProps<"/ecole/[schoolId]/annonces">) {
  const { schoolId } = await params;
  const [items, readOnly] = await Promise.all([
    api<Announcement[]>(`/schools/${encodeURIComponent(schoolId)}/announcements`),
    readOnlyOf(schoolId),
  ]);

  return (
    <ListCard title="Annonces" count={items.length} actions={!readOnly && <AddAnnouncement schoolId={schoolId} />}>
      {items.length === 0 ? (
        <p className="border-t px-5 py-12 text-center text-sm text-muted-foreground">
          Aucune annonce. Publiez-en une : elle s’affichera dans l’espace des élèves, des parents ou des enseignants.
        </p>
      ) : (
        <ul className="divide-y border-t">
          {items.map((a) => (
            <li key={a.id} className="flex gap-3 px-5 py-4">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium">{a.title}</p>
                <p className="text-sm whitespace-pre-line text-muted-foreground">{a.body}</p>
                <p className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                  {dateTime(a.createdAt)} ·
                  {a.audiences?.map((x) => (
                    <span key={x} className="rounded-md bg-muted px-2 py-0.5">
                      {AUDIENCES[x]}
                    </span>
                  ))}
                </p>
              </div>
              {!readOnly && (
                <DeleteButton
                  schoolId={schoolId}
                  kind="announcement"
                  id={a.id}
                  label={a.title}
                  warning="Elle disparaîtra de tous les espaces."
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </ListCard>
  );
}
