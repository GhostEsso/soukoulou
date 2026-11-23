import type { Slot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DeleteButton } from "./dialogs";

export const DAYS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const TONES = [
  "bg-sky-100 text-sky-950 dark:bg-sky-500/20 dark:text-sky-100",
  "bg-amber-100 text-amber-950 dark:bg-amber-500/20 dark:text-amber-100",
  "bg-violet-100 text-violet-950 dark:bg-violet-500/20 dark:text-violet-100",
  "bg-emerald-100 text-emerald-950 dark:bg-emerald-500/20 dark:text-emerald-100",
  "bg-rose-100 text-rose-950 dark:bg-rose-500/20 dark:text-rose-100",
  "bg-teal-100 text-teal-950 dark:bg-teal-500/20 dark:text-teal-100",
  "bg-orange-100 text-orange-950 dark:bg-orange-500/20 dark:text-orange-100",
  "bg-indigo-100 text-indigo-950 dark:bg-indigo-500/20 dark:text-indigo-100",
  "bg-lime-100 text-lime-950 dark:bg-lime-500/20 dark:text-lime-100",
  "bg-fuchsia-100 text-fuchsia-950 dark:bg-fuchsia-500/20 dark:text-fuchsia-100",
  "bg-cyan-100 text-cyan-950 dark:bg-cyan-500/20 dark:text-cyan-100",
  "bg-stone-200 text-stone-950 dark:bg-stone-500/20 dark:text-stone-100",
];
const ROW = 3.5; // rem par heure
const min = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

/** Jours affichés en vue semaine : lundi → vendredi, plus le samedi s'il y a cours. */
export const weekDays = (slots: Slot[]) => (slots.some((s) => s.weekday === 6) ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]);

/**
 * Grille horaire des jours demandés (1 = lundi).
 * Vue enseignant : une couleur par classe ; vue classe (`by="classroom"`) : une couleur par matière, avec l'enseignant.
 */
export function WeekSchedule({
  schoolId,
  slots,
  readOnly,
  by = "teacher",
  days = weekDays(slots),
  labels = days.map((d) => DAYS[d]),
}: {
  schoolId: string;
  slots: Slot[];
  readOnly: boolean;
  days?: number[];
  labels?: string[];
  by?: "teacher" | "classroom";
}) {
  const first = Math.min(7, ...slots.map((s) => Math.floor(min(s.start) / 60)));
  const last = Math.max(17, ...slots.map((s) => Math.ceil(min(s.end) / 60)));
  const hours = Array.from({ length: last - first }, (_, i) => first + i);
  const keyOf = (s: Slot) => (by === "teacher" ? s.classroom.id : s.subject.id);
  const keys = [...new Set(slots.map(keyOf))];

  return (
    <div className="overflow-x-auto">
      <div className={cn("grid", days.length > 1 && "min-w-[40rem]")} style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
        <span />
        {days.map((d, i) => (
          <span key={d} className="pb-2 text-center text-xs font-medium text-muted-foreground">
            {labels[i]}
          </span>
        ))}
        <div className="relative">
          {hours.map((h) => (
            <span key={h} className="block pr-2 text-right text-xs text-muted-foreground tabular-nums" style={{ height: `${ROW}rem` }}>
              {String(h).padStart(2, "0")}:00
            </span>
          ))}
        </div>
        {days.map((d) => (
          <div key={d} className="relative border-l" style={{ height: `${hours.length * ROW}rem` }}>
            {hours.map((h) => (
              <span key={h} aria-hidden className="block border-t border-dashed" style={{ height: `${ROW}rem` }} />
            ))}
            {slots
              .filter((s) => s.weekday === d)
              .map((s) => {
                const top = ((min(s.start) - first * 60) / 60) * ROW;
                const height = ((min(s.end) - min(s.start)) / 60) * ROW;
                const label = `${s.subject.shortName ?? s.subject.name} · ${s.classroom.name}`;
                const block = (
                  <span
                    className={cn(
                      "absolute inset-x-1 overflow-hidden rounded-md px-2 py-1 text-left text-xs leading-tight",
                      TONES[keys.indexOf(keyOf(s)) % TONES.length],
                      !readOnly && "cursor-pointer hover:ring-2 hover:ring-ring/40",
                    )}
                    style={{ top: `calc(${top}rem + 2px)`, height: `calc(${height}rem - 4px)` }}
                  >
                    <span className="block truncate font-semibold">
                      {by === "teacher" ? s.classroom.name : (s.subject.shortName ?? s.subject.name)}
                    </span>
                    <span className="block truncate">
                      {by === "teacher" ? (s.subject.shortName ?? s.subject.name) : s.teacher.name}
                    </span>
                    <span className="block opacity-70 tabular-nums">
                      {s.start}–{s.end}
                      {s.room && ` · ${s.room}`}
                    </span>
                  </span>
                );
                return readOnly ? (
                  <span key={s.id}>{block}</span>
                ) : (
                  <DeleteButton
                    key={s.id}
                    schoolId={schoolId}
                    kind="slot"
                    id={s.id}
                    label={`${label}, ${DAYS[d].toLowerCase()} ${s.start}`}
                    warning="Le créneau sera retiré de l’emploi du temps de la classe et de l’enseignant."
                    trigger={
                      <button type="button" aria-label={`Retirer ${label}, ${DAYS[d]} ${s.start}–${s.end}`}>
                        {block}
                      </button>
                    }
                  />
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}
