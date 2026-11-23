"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function SubmitButton({
  children,
  pendingLabel,
  size = "lg",
  disabled,
  ...rest
}: Omit<React.ComponentProps<typeof Button>, "type"> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} size={size} {...rest}>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}

export function FormMessage({ state }: { state?: { error?: string; message?: string } }) {
  if (state?.error) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
      >
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{state.error}</span>
      </div>
    );
  }
  if (state?.message) {
    return (
      <div
        role="status"
        className="flex items-start gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2.5 text-sm text-success"
      >
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{state.message}</span>
      </div>
    );
  }
  return null;
}

export function Field({
  label,
  hint,
  className,
  id,
  ...input
}: React.ComponentProps<typeof Input> & { label: string; hint?: string }) {
  const fieldId = id ?? input.name;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={fieldId}>{label}</Label>
      <Input id={fieldId} className="h-10" {...input} aria-describedby={hint ? `${fieldId}-hint` : undefined} />
      {hint && (
        <p id={`${fieldId}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Liste déroulante stylée (Radix) : soumise avec le formulaire via un select caché. */
export function SelectField({
  label,
  name,
  options,
  defaultValue,
  required,
  className,
}: {
  label: string;
  name: string;
  options: [string, string][];
  defaultValue?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={name}>{label}</Label>
      {/* key : remonte la liste quand la valeur par défaut change (saisie restaurée après une erreur). */}
      <Select key={defaultValue} name={name} defaultValue={defaultValue || undefined} required={required}>
        <SelectTrigger id={name} className="h-10 w-full bg-background shadow-xs data-[size=default]:h-10">
          <SelectValue placeholder="Choisir…" />
        </SelectTrigger>
        <SelectContent>
          {options.map(([value, text]) => (
            <SelectItem key={value} value={value}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
