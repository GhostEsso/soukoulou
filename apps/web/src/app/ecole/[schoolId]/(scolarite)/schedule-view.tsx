"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Slot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DAYS, WeekSchedule, weekDays } from "./schedule";

const DAY = 86_400_000;
const short = new Intl.DateTimeFormat("fr-FR", { day: "numeric", timeZone: "UTC" });
const long = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });

/**
 * Vue « Semaine » ou « Jour » de la semaine type, datée sur la semaine en cours.
 * `today` vient du serveur (fuseau de Lomé) pour éviter un décalage d'hydratation.
 */
export function ScheduleView({
  schoolId,
  slots,
  readOnly,
  today,
  by,
}: {
  schoolId: string;
  slots: Slot[];
  readOnly: boolean;
  today: string;
  by?: "teacher" | "classroom";
}) {
  const days = weekDays(slots);
  const now = new Date(`${today}T00:00:00Z`);
  const weekday = now.getUTCDay(); // 0 = dimanche
  // Dimanche : on montre la semaine qui commence le lendemain.
  const monday = new Date(now.getTime() - (weekday === 0 ? -1 : weekday - 1) * DAY);
  const dateOf = (d: number) => new Date(monday.getTime() + (d - 1) * DAY);
  // Sur téléphone, la semaine ne tient pas en largeur : vue « Jour » tant que l'utilisateur n'a pas choisi.
  const isMobile = useIsMobile();
  const [chosen, setView] = useState<"week" | "day" | null>(null);
  const view = chosen ?? (isMobile ? "day" : "week");
  const [day, setDay] = useState(days.includes(weekday) ? weekday : 1);
  const i = days.indexOf(day);

  const first = dateOf(days[0]);
  const last = dateOf(days[days.length - 1]);
  const title =
    view === "week"
      ? first.getUTCMonth() === last.getUTCMonth()
        ? `${short.format(first)} – ${long.format(last)}`
        : `${long.format(first)} – ${long.format(last)}`
      : `${DAYS[day]} ${long.format(dateOf(day))}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {view === "day" && (
            <Button size="icon" variant="ghost" aria-label="Jour précédent" disabled={i <= 0} onClick={() => setDay(days[i - 1])}>
              <ChevronLeft aria-hidden />
            </Button>
          )}
          <p className="text-sm font-medium" aria-live="polite">
            {title}
          </p>
          {view === "day" && (
            <Button
              size="icon"
              variant="ghost"
              aria-label="Jour suivant"
              disabled={i >= days.length - 1}
              onClick={() => setDay(days[i + 1])}
            >
              <ChevronRight aria-hidden />
            </Button>
          )}
        </div>
        <div role="group" aria-label="Affichage" className="flex rounded-lg bg-muted p-0.5">
          {(
            [
              ["week", "Semaine"],
              ["day", "Jour"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-md px-3 py-1 text-sm transition-colors",
                view === v ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {view === "week" ? (
        <WeekSchedule
          schoolId={schoolId}
          slots={slots}
          readOnly={readOnly}
          by={by}
          days={days}
          labels={days.map((d) => `${DAYS[d]} ${short.format(dateOf(d))}`)}
        />
      ) : slots.some((s) => s.weekday === day) ? (
        <WeekSchedule schoolId={schoolId} slots={slots} readOnly={readOnly} by={by} days={[day]} labels={[DAYS[day]]} />
      ) : (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Pas de cours le {DAYS[day].toLowerCase()}.
        </p>
      )}
    </div>
  );
}
