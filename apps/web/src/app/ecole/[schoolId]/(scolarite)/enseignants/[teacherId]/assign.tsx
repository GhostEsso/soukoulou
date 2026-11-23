"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Assignment, Classroom, Level } from "@/lib/types";
import { setTeacherAssignments } from "../../actions";
import { EditDialog } from "../../dialogs";

/**
 * Matières confiées à l'enseignant dans une classe. Une matière déjà confiée à un collègue
 * est grisée avec son nom : l'API refuserait de toute façon (une matière = un enseignant par classe).
 */
export function AssignDialog({
  schoolId,
  teacherId,
  classes,
  levels,
  assignments,
  classroomId,
  trigger,
}: {
  schoolId: string;
  teacherId: string;
  classes: Classroom[];
  levels: Level[];
  assignments: Assignment[];
  classroomId?: string;
  trigger: React.ReactNode;
}) {
  return (
    <EditDialog
      title={classroomId ? "Modifier les cours" : "Confier des cours"}
      description="Cochez les matières que cet enseignant assure dans la classe choisie."
      action={setTeacherAssignments.bind(null, schoolId, teacherId)}
      trigger={trigger}
    >
      {(v) => (
        <Picker
          teacherId={teacherId}
          classes={classes}
          levels={levels}
          assignments={assignments}
          initial={v.classroomId ?? classroomId ?? ""}
          locked={Boolean(classroomId)}
        />
      )}
    </EditDialog>
  );
}

function Picker({
  teacherId,
  classes,
  levels,
  assignments,
  initial,
  locked,
}: {
  teacherId: string;
  classes: Classroom[];
  levels: Level[];
  assignments: Assignment[];
  initial: string;
  locked: boolean;
}) {
  const [classroomId, setClassroomId] = useState(initial);
  const classroom = classes.find((c) => c.id === classroomId);
  const subjects = levels.find((l) => l.id === classroom?.levelId)?.subjects ?? [];
  const holder = (subjectId: string) => assignments.find((a) => a.classroomId === classroomId && a.subjectId === subjectId);

  return (
    <div className="space-y-4">
      <div className="grid gap-1.5">
        <Label htmlFor="classroomId">Classe</Label>
        {locked && <input type="hidden" name="classroomId" value={classroomId} />}
        <Select
          name={locked ? undefined : "classroomId"}
          value={classroomId || undefined}
          onValueChange={setClassroomId}
          disabled={locked}
          required
        >
          <SelectTrigger id="classroomId" className="h-10 w-full bg-background">
            <SelectValue placeholder="Choisir une classe…" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {classroom && (
        <fieldset key={classroom.id} className="space-y-2">
          <legend className="mb-2 text-sm font-medium">Matières enseignées en {classroom.level.name}</legend>
          {subjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune matière n’est encore rattachée à ce niveau.</p>
          ) : (
            <ul className="grid gap-1 sm:grid-cols-2">
              {subjects.map((s) => {
                const h = holder(s.subjectId);
                const other = h && h.teacherId !== teacherId;
                return (
                  <li key={s.subjectId}>
                    <label
                      className={
                        other
                          ? "flex items-start gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground"
                          : "flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                      }
                    >
                      <input
                        type="checkbox"
                        name={`sub_${s.subjectId}`}
                        defaultChecked={h?.teacherId === teacherId}
                        disabled={Boolean(other)}
                        className="mt-0.5 size-4 accent-primary"
                      />
                      <span>
                        {s.name}
                        {other && <span className="block text-xs">Assurée par {h.teacherName}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>
      )}
    </div>
  );
}
