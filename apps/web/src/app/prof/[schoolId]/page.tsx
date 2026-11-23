import { CalendarCheck, NotebookPen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ScheduleView } from "@/app/ecole/[schoolId]/(scolarite)/schedule-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnnouncementFeed } from "@/components/announcement-feed";
import { getFeed, getTeacherHome } from "@/lib/data";
import { todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "Accueil" };

export default async function TeacherHomePage({ params }: PageProps<"/prof/[schoolId]">) {
  const { schoolId } = await params;
  const [home, feed] = await Promise.all([getTeacherHome(schoolId), getFeed(schoolId)]);
  const base = `/prof/${schoolId}`;
  const classes = [...new Map(home.teachings.map((t) => [t.classroom.id, t.classroom])).values()];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Bonjour {home.firstName}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { href: `${base}/appel`, icon: CalendarCheck, title: "Faire l’appel", text: "Présents, absents et retards du jour." },
          { href: `${base}/notes`, icon: NotebookPen, title: "Saisir des notes", text: "Devoirs et interrogations de vos classes." },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:bg-muted">
            <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <l.icon className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block font-medium">{l.title}</span>
              <span className="block text-sm text-muted-foreground">{l.text}</span>
            </span>
          </Link>
        ))}
      </div>
      {feed.length > 0 && <AnnouncementFeed items={feed} />}
      <Card>
        <CardHeader>
          <CardTitle>Mon emploi du temps</CardTitle>
        </CardHeader>
        <CardContent>
          {home.slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun cours planifié pour l’instant.</p>
          ) : (
            <ScheduleView schoolId={schoolId} slots={home.slots} readOnly today={todayISO()} />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Mes cours</CardTitle>
        </CardHeader>
        <CardContent>
          {classes.length === 0 ? (
            <p className="text-sm text-muted-foreground">L’école ne vous a pas encore confié de cours.</p>
          ) : (
            <ul className="divide-y text-sm">
              {classes.map((c) => (
                <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground">
                    {home.teachings
                      .filter((t) => t.classroom.id === c.id)
                      .map((t) => t.subject.name)
                      .join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
