import { StatusBadge } from "@/components/status-badge";
import { date, DISCIPLINE } from "@/lib/format";
import type { DisciplineRecord } from "@/lib/types";

/** Dossier de discipline : totaux par type puis inscriptions, de la plus récente à la plus ancienne. */
export function DisciplineList({
  items,
  action,
}: {
  items: DisciplineRecord[];
  /** Bouton par ligne (suppression côté administration). */
  action?: (r: DisciplineRecord) => React.ReactNode;
}) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Rien au dossier.</p>;
  return (
    <div className="space-y-3">
      <p className="flex flex-wrap gap-2">
        {Object.entries(DISCIPLINE).map(([kind, { label, tone }]) => {
          const n = items.filter((r) => r.kind === kind).length;
          return n > 0 && <StatusBadge key={kind} tone={tone}>{`${n} ${label.toLowerCase()}${n > 1 ? "s" : ""}`}</StatusBadge>;
        })}
      </p>
      <ul className="divide-y rounded-lg border text-sm">
        {items.map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-3 px-3 py-2">
            <span className="min-w-0 space-y-1">
              <span className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={DISCIPLINE[r.kind].tone}>{DISCIPLINE[r.kind].label}</StatusBadge>
                <span className="text-xs text-muted-foreground">{date(r.day)}</span>
              </span>
              <span className="block break-words">{r.reason}</span>
            </span>
            {action?.(r)}
          </li>
        ))}
      </ul>
    </div>
  );
}
