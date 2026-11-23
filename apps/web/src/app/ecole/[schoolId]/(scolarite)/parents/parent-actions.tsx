"use client";

import { KeyRound, Pencil, Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RELATIONS } from "@/lib/format";
import type { Parent, ParentRelation } from "@/lib/types";
import { createParent, searchStudents, updateParent } from "../actions";
import { AccessPanel } from "../access-panel";
import { DeleteButton, EditDialog } from "../dialogs";

type Child = { id: string; name: string; classroom: string | null; relation: ParentRelation | "" };

/** Enfants rattachés : recherche d'élève par nom ou matricule, puis lien (père, mère, tuteur) pour chacun. */
function ChildrenPicker({ schoolId, initial }: { schoolId: string; initial: Child[] }) {
  const [children, setChildren] = useState(initial);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Omit<Child, "relation">[]>([]);

  useEffect(() => {
    // Petite attente pour ne pas interroger l'API à chaque lettre.
    const t = setTimeout(() => {
      searchStudents(schoolId, q).then(setFound, () => setFound([]));
    }, 250);
    return () => clearTimeout(t);
  }, [schoolId, q]);

  const results = q.trim().length < 2 ? [] : found.filter((f) => !children.some((c) => c.id === f.id));

  return (
    <fieldset className="space-y-2 sm:col-span-2">
      <legend className="mb-1.5 text-sm font-medium">Enfants</legend>
      {children.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {children.map((c) => (
            <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{c.name}</span>
                {c.classroom && <span className="text-muted-foreground"> · {c.classroom}</span>}
              </span>
              <select
                name={`child_${c.id}`}
                required
                value={c.relation}
                onChange={(e) =>
                  setChildren((all) => all.map((x) => (x.id === c.id ? { ...x, relation: e.target.value as ParentRelation } : x)))
                }
                aria-label={`Lien avec ${c.name}`}
                className="h-8 rounded-md border bg-background px-2 text-sm"
              >
                <option value="" disabled>
                  Lien…
                </option>
                {Object.entries(RELATIONS).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8"
                aria-label={`Retirer ${c.name}`}
                onClick={() => setChildren((all) => all.filter((x) => x.id !== c.id))}
              >
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <Label htmlFor="child-search" className="sr-only">
          Rechercher un élève
        </Label>
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="child-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ajouter un enfant : nom ou matricule…"
          autoComplete="off"
          className="h-10 pl-9"
        />
        {results.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-auto rounded-lg border bg-popover p-1 shadow-md">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setChildren((all) => [...all, { ...r, relation: "" }]);
                    setQ("");
                  }}
                >
                  <span className="font-medium">{r.name}</span>
                  <span className="text-xs text-muted-foreground">{r.classroom ?? "Non inscrit"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </fieldset>
  );
}

function Fields({ schoolId, v, p, initial }: { schoolId: string; v: Record<string, string>; p?: Parent; initial: Child[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nom" name="lastName" required autoComplete="off" defaultValue={v.lastName ?? p?.lastName} />
      <Field label="Prénom(s)" name="firstName" required autoComplete="off" defaultValue={v.firstName ?? p?.firstName} />
      <Field
        label="Téléphone"
        name="phone"
        type="tel"
        required
        placeholder="+228 90 00 00 00"
        defaultValue={v.phone ?? p?.phone}
      />
      <Field label="Email" name="email" type="email" autoComplete="off" defaultValue={v.email ?? p?.email ?? ""} />
      <Field label="Profession" name="profession" defaultValue={v.profession ?? p?.profession ?? ""} />
      <Field label="Adresse" name="address" defaultValue={v.address ?? p?.address ?? ""} />
      <ChildrenPicker schoolId={schoolId} initial={initial} />
    </div>
  );
}

const childrenOf = (p: Parent): Child[] =>
  p.children.map((c) => ({
    id: c.id,
    name: `${c.lastName} ${c.firstName}`,
    classroom: c.classroom?.name ?? null,
    relation: c.relation,
  }));

/** Nouveau parent ; `child` pré-rattache un élève (depuis sa fiche). */
export function AddParent({
  schoolId,
  child,
  trigger,
}: {
  schoolId: string;
  child?: { id: string; name: string; classroom: string | null };
  trigger?: React.ReactNode;
}) {
  return (
    <EditDialog
      title="Nouveau parent"
      description="Le téléphone sert à joindre la famille : un même numéro ne peut appartenir qu’à un parent."
      action={createParent.bind(null, schoolId)}
      submitLabel="Ajouter"
      trigger={
        trigger ?? (
          <Button className="h-10">
            <Plus aria-hidden /> Ajouter
          </Button>
        )
      }
    >
      {(v) => <Fields schoolId={schoolId} v={v} initial={child ? [{ ...child, relation: "" }] : []} />}
    </EditDialog>
  );
}

export function EditParent({ schoolId, parent }: { schoolId: string; parent: Parent }) {
  const name = `${parent.firstName} ${parent.lastName}`;
  return (
    <EditDialog
      title={`Modifier ${name}`}
      action={updateParent.bind(null, schoolId, parent.id)}
      trigger={
        <Button size="icon" variant="ghost" aria-label={`Modifier ${name}`}>
          <Pencil aria-hidden />
        </Button>
      }
    >
      {(v) => <Fields schoolId={schoolId} v={v} p={parent} initial={childrenOf(parent)} />}
    </EditDialog>
  );
}

export function DeleteParent({ schoolId, parent }: { schoolId: string; parent: Parent }) {
  return (
    <DeleteButton
      schoolId={schoolId}
      kind="parent"
      id={parent.id}
      label={`${parent.firstName} ${parent.lastName}`}
      warning="La fiche du parent est supprimée ; ses enfants restent inscrits."
    />
  );
}

/** Accès du parent à son espace : clé pleine quand il en a un. */
export function ParentAccess({ schoolId, parent }: { schoolId: string; parent: Parent }) {
  const name = `${parent.firstName} ${parent.lastName}`;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Accès de ${name}${parent.account ? " (actif)" : ""}`}
          className={parent.account ? "text-primary" : undefined}
        >
          <KeyRound aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Accès de {name}</DialogTitle>
          <DialogDescription>Son espace parent : notes, absences et emploi du temps de ses enfants.</DialogDescription>
        </DialogHeader>
        <AccessPanel schoolId={schoolId} kind="parents" id={parent.id} name={name} phone={parent.phone} account={parent.account} readOnly={false} />
      </DialogContent>
    </Dialog>
  );
}
