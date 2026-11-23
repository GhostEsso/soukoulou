/** Moyennes ramenées sur 20, arrondies au centième. null quand il n'y a aucune note. */

export const on20 = (score: number, max: number) => (score * 20) / max;

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return (
    Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
  );
}

/** Moyenne générale : moyennes de matière pondérées par leur coefficient (matières sans note ignorées). */
export function weighted(
  subjects: { average: number | null; coefficient: number }[],
): number | null {
  const rated = subjects.filter(
    (s): s is { average: number; coefficient: number } => s.average !== null,
  );
  const coefs = rated.reduce((n, s) => n + s.coefficient, 0);
  if (!coefs) return null;
  return (
    Math.round(
      (rated.reduce((n, s) => n + s.average * s.coefficient, 0) / coefs) * 100,
    ) / 100
  );
}

/** Rang (1 = premier, ex aequo au même rang) de `value` parmi `all`. */
export const rankOf = (value: number, all: number[]) =>
  1 + all.filter((v) => v > value).length;

export interface GradedAssessment {
  subjectId: string;
  maxScore: number;
  grades: { studentId: string; score: number }[];
}

/**
 * Résultats d'une classe sur une période : moyenne de chaque élève par matière et moyenne générale.
 * `assessments` = évaluations de la classe pour cette période.
 */
export function classResults(
  subjects: { id: string; coefficient: number }[],
  assessments: GradedAssessment[],
  studentIds: string[],
) {
  return new Map(
    studentIds.map((id) => {
      const bySubject = new Map(
        subjects.map((s) => [
          s.id,
          mean(
            assessments
              .filter((a) => a.subjectId === s.id)
              .flatMap((a) =>
                a.grades
                  .filter((g) => g.studentId === id)
                  .map((g) => on20(g.score, a.maxScore)),
              ),
          ),
        ]),
      );
      const average = weighted(
        subjects.map((s) => ({
          coefficient: s.coefficient,
          average: bySubject.get(s.id) ?? null,
        })),
      );
      return [id, { subjects: bySubject, average }] as const;
    }),
  );
}

// ponytail: barèmes fixes ; à rendre réglables par école si une école le demande.
/** Appréciation d'une moyenne sur 20. */
export function appreciation(avg: number | null): string | null {
  if (avg === null) return null;
  if (avg >= 16) return 'Excellent';
  if (avg >= 14) return 'Très bien';
  if (avg >= 12) return 'Bien';
  if (avg >= 10) return 'Assez bien';
  if (avg >= 8) return 'Insuffisant';
  return 'Faible';
}

/** Distinction du conseil de classe d'après la moyenne générale. */
export function mention(avg: number | null): string | null {
  if (avg === null) return null;
  if (avg >= 16) return 'Félicitations';
  if (avg >= 14) return 'Encouragements';
  if (avg >= 12) return 'Tableau d’honneur';
  if (avg < 8) return 'Avertissement travail';
  return null;
}

/** Clé du bilan annuel (à la place d'un id de période). */
export const ANNUAL = 'annual';

// ponytail: seuil de passage fixe ; à rendre réglable par école (certaines exigent 9 ou 10,5).
export const PASS_MARK = 10;

/** Décision proposée au conseil d'après la moyenne annuelle. */
export const decide = (avg: number | null) =>
  avg === null
    ? null
    : avg >= PASS_MARK
      ? ('PROMOTED' as const)
      : ('REPEATING' as const);
