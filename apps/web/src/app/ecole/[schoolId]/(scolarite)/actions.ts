"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api, ApiError, formValues, type ActionState } from "@/lib/api";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const school = (schoolId: string) => `/schools/${encodeURIComponent(schoolId)}`;
const base = (schoolId: string) => `${school(schoolId)}/structure`;

async function call(
  schoolId: string,
  path: string,
  init: { method: string; json?: unknown },
  success: string,
  form?: FormData,
  fromSchool = false,
): Promise<ActionState> {
  try {
    await api(`${fromSchool ? school(schoolId) : base(schoolId)}${path}`, init);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message, values: form ? formValues(form) : undefined };
    throw e;
  }
  revalidatePath(`/ecole/${schoolId}`, "layout");
  revalidatePath(`/prof/${schoolId}`, "layout");
  return { ok: true, message: success };
}

const id = (v: string) => encodeURIComponent(v);

// ── Années ───────────────────────────────────────────────

export async function createYear(schoolId: string, _: ActionState, form: FormData) {
  return call(
    schoolId,
    "/years",
    {
      method: "POST",
      json: {
        label: str(form, "label"),
        startsOn: str(form, "startsOn"),
        endsOn: str(form, "endsOn"),
        periodType: str(form, "periodType"),
      },
    },
    "Année créée. Les périodes ont été découpées automatiquement : ajustez-les si besoin.",
    form,
  );
}

/** Dates de l'année et de chaque période (champs p0_name, p0_start, p0_end…). */
export async function updateYear(schoolId: string, yearId: string, count: number, _: ActionState, form: FormData) {
  const periods = Array.from({ length: count }, (_, i) => ({
    name: str(form, `p${i}_name`),
    startsOn: str(form, `p${i}_start`),
    endsOn: str(form, `p${i}_end`),
  }));
  return call(
    schoolId,
    `/years/${id(yearId)}`,
    {
      method: "PATCH",
      json: { label: str(form, "label"), startsOn: str(form, "startsOn"), endsOn: str(form, "endsOn"), periods },
    },
    "Année enregistrée.",
    form,
  );
}

export async function setCurrentYear(schoolId: string, yearId: string, _: ActionState) {
  return call(schoolId, `/years/${id(yearId)}`, { method: "PATCH", json: { isCurrent: true } }, "Année en cours modifiée.");
}

// ── Niveaux et matières ──────────────────────────────────

export async function createLevel(schoolId: string, _: ActionState, form: FormData) {
  return call(schoolId, "/levels", { method: "POST", json: { name: str(form, "name") } }, "Niveau ajouté.", form);
}

export async function renameLevel(schoolId: string, levelId: string, _: ActionState, form: FormData) {
  return call(
    schoolId,
    `/levels/${id(levelId)}`,
    { method: "PATCH", json: { name: str(form, "name") } },
    "Niveau renommé.",
    form,
  );
}

export async function orderLevels(schoolId: string, ids: string[], _: ActionState) {
  return call(schoolId, "/levels/order", { method: "PUT", json: { ids } }, "Ordre enregistré.");
}

/** Cases « use_<id> » cochées + coefficient « coef_<id> ». */
export async function setLevelSubjects(schoolId: string, levelId: string, _: ActionState, form: FormData) {
  const items = [...form.keys()]
    .filter((k) => k.startsWith("use_"))
    .map((k) => {
      const subjectId = k.slice(4);
      return { subjectId, coefficient: Number(str(form, `coef_${subjectId}`).replace(",", ".")) };
    });
  if (items.some((i) => !Number.isFinite(i.coefficient) || i.coefficient <= 0)) {
    return { error: "Chaque matière cochée doit avoir un coefficient supérieur à 0.", values: formValues(form) };
  }
  return call(
    schoolId,
    `/levels/${id(levelId)}/subjects`,
    { method: "PUT", json: { items } },
    "Matières et coefficients enregistrés.",
    form,
  );
}

export async function createSubject(schoolId: string, _: ActionState, form: FormData) {
  return call(
    schoolId,
    "/subjects",
    { method: "POST", json: { name: str(form, "name"), shortName: str(form, "shortName") || undefined } },
    "Matière ajoutée.",
    form,
  );
}

export async function updateSubject(schoolId: string, subjectId: string, _: ActionState, form: FormData) {
  return call(
    schoolId,
    `/subjects/${id(subjectId)}`,
    { method: "PATCH", json: { name: str(form, "name"), shortName: str(form, "shortName") } },
    "Matière enregistrée.",
    form,
  );
}

// ── Classes ──────────────────────────────────────────────

const capacityOf = (form: FormData) => {
  const v = str(form, "capacity");
  return v ? Number(v) : undefined;
};

export async function createClassroom(schoolId: string, _: ActionState, form: FormData) {
  return call(
    schoolId,
    "/classrooms",
    {
      method: "POST",
      json: {
        yearId: str(form, "yearId"),
        levelId: str(form, "levelId"),
        name: str(form, "name"),
        capacity: capacityOf(form),
      },
    },
    "Classe ajoutée.",
    form,
  );
}

export async function updateClassroom(schoolId: string, classroomId: string, _: ActionState, form: FormData) {
  return call(
    schoolId,
    `/classrooms/${id(classroomId)}`,
    {
      method: "PATCH",
      json: { levelId: str(form, "levelId"), name: str(form, "name"), capacity: capacityOf(form) ?? null },
    },
    "Classe enregistrée.",
    form,
  );
}

// ── Suppressions ─────────────────────────────────────────

const KINDS = {
  year: "/structure/years",
  level: "/structure/levels",
  subject: "/structure/subjects",
  classroom: "/structure/classrooms",
  student: "/students",
  teacher: "/teachers",
  slot: "/schedule",
  assessment: "/assessments",
  parent: "/parents",
  myAssessment: "/teacher/assessments",
  announcement: "/announcements",
  discipline: "/discipline",
} as const;

export async function removeItem(
  schoolId: string,
  kind: keyof typeof KINDS,
  itemId: string,
  redirectTo: string | undefined,
  _: ActionState,
) {
  const r = await call(schoolId, `${KINDS[kind]}/${id(itemId)}`, { method: "DELETE" }, "Supprimé.", undefined, true);
  if (r?.ok && (redirectTo?.startsWith(`/ecole/${schoolId}/`) || redirectTo?.startsWith(`/prof/${schoolId}/`)))
    redirect(redirectTo);
  return r;
}

// ── Élèves ───────────────────────────────────────────────

const student = (form: FormData) => ({
  firstName: str(form, "firstName"),
  lastName: str(form, "lastName"),
  sex: str(form, "sex"),
  birthDate: str(form, "birthDate"),
  matricule: str(form, "matricule"),
  classroomId: str(form, "classroomId"),
});

export async function createStudent(schoolId: string, _: ActionState, form: FormData) {
  return call(schoolId, "/students", { method: "POST", json: student(form) }, "Élève inscrit.", form, true);
}

export async function updateStudent(schoolId: string, studentId: string, _: ActionState, form: FormData) {
  return call(
    schoolId,
    `/students/${id(studentId)}`,
    { method: "PATCH", json: { ...student(form), birthDate: str(form, "birthDate") || null } },
    "Élève enregistré.",
    form,
    true,
  );
}

// ── Présences ────────────────────────────────────────────

/** Appel : un champ « s_<idÉlève> » par élève, valeur PRESENT | ABSENT | LATE. */
/** `teacher` : appel fait depuis l'espace enseignant (API restreinte à ses classes). */
export async function saveRollCall(schoolId: string, classroomId: string, day: string, _: ActionState, form: FormData, teacher = false) {
  const items = [...form.entries()]
    .filter(([k]) => k.startsWith("s_"))
    .map(([k, v]) => ({ studentId: k.slice(2), status: String(v) }));
  if (items.length === 0) return { error: "Aucun élève dans cette classe." };
  const absent = items.filter((i) => i.status === "ABSENT").length;
  return call(
    schoolId,
    `${teacher ? "/teacher" : ""}/attendance`,
    { method: "PUT", json: { classroomId, day, items } },
    `Appel enregistré : ${items.length - absent} présent${items.length - absent > 1 ? "s" : ""}, ${absent} absent${absent > 1 ? "s" : ""}.`,
    undefined,
    true,
  );
}

// ── Enseignants ──────────────────────────────────────────

const teacher = (form: FormData) => ({
  firstName: str(form, "firstName"),
  lastName: str(form, "lastName"),
  sex: str(form, "sex"),
  email: str(form, "email"),
  phone: str(form, "phone"),
  address: str(form, "address"),
  matricule: str(form, "matricule"),
});

export async function createTeacher(schoolId: string, _: ActionState, form: FormData) {
  return call(schoolId, "/teachers", { method: "POST", json: teacher(form) }, "Enseignant ajouté.", form, true);
}

export async function updateTeacher(schoolId: string, teacherId: string, _: ActionState, form: FormData) {
  return call(schoolId, `/teachers/${id(teacherId)}`, { method: "PATCH", json: teacher(form) }, "Fiche enregistrée.", form, true);
}

/** Matières confiées dans une classe : cases « sub_<idMatière> » cochées. */
export async function setTeacherAssignments(schoolId: string, teacherId: string, _: ActionState, form: FormData) {
  const classroomId = str(form, "classroomId");
  if (!classroomId) return { error: "Choisissez une classe.", values: formValues(form) };
  const subjectIds = [...form.keys()].filter((k) => k.startsWith("sub_")).map((k) => k.slice(4));
  return call(
    schoolId,
    `/teachers/${id(teacherId)}/assignments/${id(classroomId)}`,
    { method: "PUT", json: { subjectIds } },
    "Cours enregistrés.",
    form,
    true,
  );
}

// ── Emploi du temps ──────────────────────────────────────

export async function createSlot(schoolId: string, _: ActionState, form: FormData) {
  return call(
    schoolId,
    "/schedule",
    {
      method: "POST",
      json: {
        teachingId: str(form, "teachingId"),
        weekday: Number(str(form, "weekday")),
        start: str(form, "start"),
        end: str(form, "end"),
        room: str(form, "room"),
      },
    },
    "Créneau ajouté.",
    form,
    true,
  );
}

// ── Notes ────────────────────────────────────────────────

export async function createAssessment(schoolId: string, teacher: boolean, _: ActionState, form: FormData) {
  return call(
    schoolId,
    `${teacher ? "/teacher" : ""}/assessments`,
    {
      method: "POST",
      json: {
        classroomId: str(form, "classroomId"),
        subjectId: str(form, "subjectId"),
        title: str(form, "title"),
        day: str(form, "day"),
        maxScore: Number(str(form, "maxScore")),
      },
    },
    "Évaluation créée : saisissez les notes.",
    form,
    true,
  );
}

/** Notes : un champ « n_<idÉlève> » par élève ; vide = pas de note. Virgule acceptée. */
export async function saveGrades(
  schoolId: string,
  assessmentId: string,
  max: number,
  _: ActionState,
  form: FormData,
  teacher = false,
) {
  const items = [...form.entries()]
    .filter(([k]) => k.startsWith("n_"))
    .map(([k, v]) => {
      const raw = String(v).trim().replace(",", ".");
      return { studentId: k.slice(2), score: raw === "" ? null : Number(raw) };
    });
  if (items.some((i) => i.score !== null && (!Number.isFinite(i.score) || i.score < 0 || i.score > max))) {
    return { error: `Chaque note doit être un nombre entre 0 et ${max}.` };
  }
  const n = items.filter((i) => i.score !== null).length;
  return call(
    schoolId,
    `${teacher ? "/teacher" : ""}/assessments/${id(assessmentId)}/grades`,
    { method: "PUT", json: { items } },
    `${n} note${n > 1 ? "s" : ""} enregistrée${n > 1 ? "s" : ""}.`,
    undefined,
    true,
  );
}

// ── Conseil de classe ────────────────────────────────────

/** Avis du conseil : « c_<idÉlève> » = appréciation, « d_<idÉlève> » = décision (bilan annuel). */
export async function saveCouncil(schoolId: string, classroomId: string, scope: string, _: ActionState, form: FormData) {
  const ids = [...form.keys()].filter((k) => k.startsWith("c_")).map((k) => k.slice(2));
  const items = ids.map((studentId) => ({
    studentId,
    comment: str(form, `c_${studentId}`),
    decision: str(form, `d_${studentId}`) || undefined,
  }));
  if (items.some((i) => i.comment.length > 300)) return { error: "Une appréciation dépasse 300 caractères." };
  return call(
    schoolId,
    "/assessments/council",
    { method: "PUT", json: { classroomId, scope, items } },
    "Avis du conseil enregistrés.",
    undefined,
    true,
  );
}

// ── Parents ──────────────────────────────────────────────

/** Fiche parent + enfants : un champ « child_<idÉlève> » = lien (FATHER | MOTHER | GUARDIAN). */
const parent = (form: FormData) => ({
  firstName: str(form, "firstName"),
  lastName: str(form, "lastName"),
  phone: str(form, "phone"),
  email: str(form, "email"),
  address: str(form, "address"),
  profession: str(form, "profession"),
  children: [...form.entries()]
    .filter(([k]) => k.startsWith("child_"))
    .map(([k, v]) => ({ studentId: k.slice(6), relation: String(v) })),
});

export async function createParent(schoolId: string, _: ActionState, form: FormData) {
  return call(schoolId, "/parents", { method: "POST", json: parent(form) }, "Parent ajouté.", form, true);
}

export async function updateParent(schoolId: string, parentId: string, _: ActionState, form: FormData) {
  return call(schoolId, `/parents/${id(parentId)}`, { method: "PATCH", json: parent(form) }, "Fiche enregistrée.", form, true);
}

/** Recherche d'élèves pour les rattacher à un parent (nom, prénom ou matricule). */
export async function searchStudents(schoolId: string, q: string) {
  if (q.trim().length < 2) return [];
  const page = await api<{ items: { id: string; firstName: string; lastName: string; classroom: { name: string } | null }[] }>(
    `${school(schoolId)}/students?${new URLSearchParams({ q: q.trim().slice(0, 80) })}`,
  );
  return page.items.slice(0, 8).map((s) => ({
    id: s.id,
    name: `${s.lastName} ${s.firstName}`,
    classroom: s.classroom?.name ?? null,
  }));
}

// ── Accès enseignant / parent ────────────────────────────

export type AccessState = { error?: string; phone?: string | null; code?: string | null } | undefined;

export type AccountKind = "teachers" | "parents" | "students";

/** Crée l'accès (`create`) ou génère un nouveau code (`reset`) ; le code n'est montré qu'une fois. */
export async function grantAccess(schoolId: string, kind: AccountKind, itemId: string, mode: "create" | "reset"): Promise<AccessState> {
  try {
    const r = await api<{ phone: string | null; code: string | null }>(
      `${school(schoolId)}/${kind}/${id(itemId)}/access${mode === "reset" ? "/reset" : ""}`,
      { method: "POST" },
    );
    revalidatePath(`/ecole/${schoolId}`, "layout");
    return r;
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
}

export async function removeAccess(schoolId: string, kind: AccountKind, itemId: string, _: ActionState) {
  return call(schoolId, `/${kind}/${id(itemId)}/access`, { method: "DELETE" }, "Accès retiré.", undefined, true);
}

// ── Annonces ─────────────────────────────────────────────

export async function createAnnouncement(schoolId: string, _: ActionState, form: FormData) {
  return call(
    schoolId,
    "/announcements",
    {
      method: "POST",
      json: { title: str(form, "title"), body: str(form, "body"), audiences: form.getAll("audiences").map(String) },
    },
    "Annonce publiée.",
    form,
    true,
  );
}

// ── Discipline ───────────────────────────────────────────

export async function createDiscipline(schoolId: string, studentId: string, _: ActionState, form: FormData) {
  return call(
    schoolId,
    "/discipline",
    { method: "POST", json: { studentId, kind: str(form, "kind"), day: str(form, "day"), reason: str(form, "reason") } },
    "Inscrit au dossier.",
    form,
    true,
  );
}

// ── Photos de profil (enseignants, élèves) ───────────────

export type PhotoKind = "teachers" | "students";

export async function uploadPhoto(schoolId: string, kind: PhotoKind, itemId: string, form: FormData): Promise<ActionState> {
  const file = form.get("file");
  if (!(file instanceof File)) return { error: "Choisissez une photo." };
  const body = new FormData();
  body.set("file", file);
  try {
    await api(`${school(schoolId)}/${kind}/${id(itemId)}/photo`, { method: "PUT", body });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/ecole/${schoolId}`, "layout");
  return { ok: true };
}

export async function removePhoto(schoolId: string, kind: PhotoKind, itemId: string): Promise<ActionState> {
  return call(schoolId, `/${kind}/${id(itemId)}/photo`, { method: "DELETE" }, "Photo retirée.", undefined, true);
}
