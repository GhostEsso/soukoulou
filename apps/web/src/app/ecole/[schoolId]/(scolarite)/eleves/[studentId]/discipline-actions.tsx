"use client";

import { Plus } from "lucide-react";
import { Field, SelectField } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DISCIPLINE, todayISO } from "@/lib/format";
import { createDiscipline } from "../../actions";
import { EditDialog } from "../../dialogs";

const KINDS = Object.entries(DISCIPLINE).map(([k, { label }]): [string, string] => [k, label]);

export function AddDiscipline({ schoolId, studentId, name }: { schoolId: string; studentId: string; name: string }) {
  return (
    <EditDialog
      title="Inscrire au dossier"
      description={`${name} et ses parents le verront dans leur espace.`}
      action={createDiscipline.bind(null, schoolId, studentId)}
      submitLabel="Inscrire"
      trigger={
        <Button size="sm" variant="outline">
          <Plus aria-hidden /> Mérite, punition ou blâme
        </Button>
      }
    >
      {(v) => (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Type" name="kind" required options={KINDS} defaultValue={v.kind ?? "MERIT"} />
            <Field label="Date" name="day" type="date" required max={todayISO()} defaultValue={v.day ?? todayISO()} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="reason">Motif</Label>
            <Textarea
              id="reason"
              name="reason"
              required
              maxLength={500}
              rows={3}
              placeholder="Travail remarquable en mathématiques"
              defaultValue={v.reason ?? ""}
            />
          </div>
        </div>
      )}
    </EditDialog>
  );
}
