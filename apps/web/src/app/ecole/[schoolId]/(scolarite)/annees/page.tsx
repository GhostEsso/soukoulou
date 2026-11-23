import type { Metadata } from "next";
import { getStructure } from "@/lib/data";
import { ListCard, readOnlyOf } from "../list";
import { AddYear, YearsList } from "./years";

export const metadata: Metadata = { title: "Années scolaires" };

export default async function YearsPage({ params }: PageProps<"/ecole/[schoolId]/annees">) {
  const { schoolId } = await params;
  const [data, readOnly] = await Promise.all([getStructure(schoolId), readOnlyOf(schoolId)]);
  return (
    <ListCard
      title="Années scolaires"
      count={data.years.length}
      actions={!readOnly && <AddYear schoolId={schoolId} first={data.years.length === 0} />}
    >
      <div className="border-t p-4 sm:p-5">
        <YearsList schoolId={schoolId} years={data.years} readOnly={readOnly} />
      </div>
    </ListCard>
  );
}
