import { ArrowRight, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOnboarding } from "@/lib/data";
import { money } from "@/lib/format";

export const metadata: Metadata = { title: "École de démo" };

// ponytail: données de démo statiques, à remplacer par une vraie école démo en lecture seule quand les modules existeront.
const KPIS = [
  { label: "Élèves inscrits", value: "412" },
  { label: "Présence aujourd’hui", value: "96 %" },
  { label: "Frais encaissés", value: money(18_450_000) },
  { label: "Bulletins publiés", value: "1er trim." },
];
const CLASSES = [
  { name: "CM2 A", teacher: "M. Agbeko", students: 42, average: "13,4" },
  { name: "CM1 B", teacher: "Mme Mensah", students: 38, average: "12,9" },
  { name: "6e A", teacher: "M. Kodjo", students: 45, average: "11,8" },
  { name: "3e B", teacher: "Mme Afi", students: 40, average: "12,2" },
];

export default async function DemoPage({ params }: PageProps<"/ecole/[schoolId]/decouverte">) {
  const { schoolId } = await params;
  const { school } = await getOnboarding(schoolId);
  if (school.subscriptionStatus !== "DISCOVERY") redirect(`/ecole/${school.id}`);

  return (
    <>
      <PageHeader
        title="Collège de démonstration"
        description="Une école fictive pour découvrir Soukoulou. Rien n’est modifiable ici."
        actions={
          <Button asChild>
            <Link href={`/ecole/${school.id}/upgrade`}>
              Utiliser avec mon école <ArrowRight aria-hidden />
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {KPIS.map((k) => (
          <Card key={k.label}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Classes</CardTitle>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" aria-hidden /> Lecture seule
          </span>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Classe</TableHead>
                <TableHead>Titulaire</TableHead>
                <TableHead className="text-right">Élèves</TableHead>
                <TableHead className="text-right">Moyenne</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CLASSES.map((c) => (
                <TableRow key={c.name}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.teacher}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.students}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.average}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
