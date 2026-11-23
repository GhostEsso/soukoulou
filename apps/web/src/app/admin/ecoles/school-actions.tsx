"use client";

import { Ban, FileSearch, MoreHorizontal, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { FormMessage, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { reactivate, suspend } from "../actions";

export function SchoolActions({ schoolId, name, suspended }: { schoolId: string; name: string; suspended: boolean }) {
  const [open, setOpen] = useState(false);
  const [reactivating, startReactivate] = useTransition();
  const [state, action] = useActionState(async (prev: Awaited<ReturnType<typeof suspend>>, form: FormData) => {
    const r = await suspend(schoolId, prev, form);
    if (r?.ok) {
      setOpen(false);
      toast.success(r.message);
    }
    return r;
  }, undefined);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions pour ${name}`} disabled={reactivating}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href={`/admin/verifications/${schoolId}`}>
              <FileSearch aria-hidden /> Voir le dossier
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {suspended ? (
            <DropdownMenuItem
              onSelect={() =>
                startReactivate(async () => {
                  const r = await reactivate(schoolId, undefined);
                  if (r?.error) toast.error(r.error);
                  else toast.success(r?.message);
                })
              }
            >
              <RotateCcw aria-hidden /> Réactiver
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem variant="destructive" onSelect={() => setOpen(true)}>
              <Ban aria-hidden /> Suspendre…
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form action={action} className="space-y-4 text-left">
            <DialogHeader>
              <DialogTitle>Suspendre {name} ?</DialogTitle>
              <DialogDescription>
                Plus personne de l’école ne pourra se connecter. Les données sont conservées et l’école peut être
                réactivée à tout moment.
              </DialogDescription>
            </DialogHeader>
            {state?.error && <FormMessage state={state} />}
            <div className="grid gap-1.5">
              <Label htmlFor={`reason-${schoolId}`}>Motif (communiqué à l’école)</Label>
              <Textarea
                id={`reason-${schoolId}`}
                name="reason"
                required
                minLength={3}
                maxLength={500}
                defaultValue={state?.values?.reason}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <SubmitButton variant="destructive" size="default" pendingLabel="Suspension…">
                Suspendre l’école
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
