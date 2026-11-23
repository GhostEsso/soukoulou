import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { COUNTRIES, date } from "@/lib/format";
import type { SchoolCalendar } from "@/lib/types";
import { CalendarForm, DeleteCalendar } from "./calendar-form";

export const metadata: Metadata = { title: "Années scolaires" };

export default async function CalendarsPage() {
  const rows = await api<SchoolCalendar[]>("/platform/calendars");
  return (
    <>
      <PageHeader
        title="Années scolaires"
        description="Hors de ces dates, les écoles passent en lecture seule gratuite (vacances)."
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {rows.length === 0 ? (
          <EmptyState icon={<CalendarDays className="size-5" aria-hidden />} title="Aucune année scolaire" />
        ) : (
          <div className="self-start overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pays</TableHead>
                  <TableHead>Année</TableHead>
                  <TableHead>Rentrée</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Action</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{COUNTRIES[c.country] ?? c.country}</TableCell>
                    <TableCell className="font-medium">{c.schoolYearLabel}</TableCell>
                    <TableCell>{date(c.startsOn)}</TableCell>
                    <TableCell>{date(c.endsOn)}</TableCell>
                    <TableCell className="text-right">
                      <DeleteCalendar id={c.id} label={`${COUNTRIES[c.country] ?? c.country} ${c.schoolYearLabel}`} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <CalendarForm />
      </div>
    </>
  );
}
