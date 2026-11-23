"use client";

import { Megaphone } from "lucide-react";
import { Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AUDIENCES } from "@/lib/format";
import { createAnnouncement } from "../actions";
import { EditDialog } from "../dialogs";

export function AddAnnouncement({ schoolId }: { schoolId: string }) {
  return (
    <EditDialog
      title="Nouvelle annonce"
      description="Elle apparaît tout de suite dans l’espace des publics choisis."
      action={createAnnouncement.bind(null, schoolId)}
      submitLabel="Publier"
      trigger={
        <Button className="h-10">
          <Megaphone aria-hidden /> Nouvelle annonce
        </Button>
      }
    >
      {(v) => (
        <div className="grid gap-4">
          <Field label="Titre" name="title" required maxLength={120} placeholder="Réunion parents-professeurs" defaultValue={v.title ?? ""} />
          <div className="grid gap-1.5">
            <Label htmlFor="body">Message</Label>
            <Textarea id="body" name="body" required maxLength={2000} rows={6} defaultValue={v.body ?? ""} />
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Destinataires</legend>
            <div className="flex flex-wrap gap-4">
              {Object.entries(AUDIENCES).map(([value, label]) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" name="audiences" value={value} defaultChecked={value !== "TEACHER"} className="size-4 accent-primary" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}
    </EditDialog>
  );
}
