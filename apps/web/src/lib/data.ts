import "server-only";
import { cache } from "react";
import { api } from "./api";
import type { Announcement, AttendanceDay, Me, Onboarding, Plan, Structure, ParentHome, StudentHome, StudentStats, TeacherHome } from "./types";

// Dédupliqués sur une même requête (layout + page).
export const getMe = cache(() => api<Me>("/auth/me"));
export const getOnboarding = cache((schoolId: string) =>
  api<Onboarding>(`/schools/${encodeURIComponent(schoolId)}/onboarding`),
);
/** Espace enseignant : 403 si le compte n'est pas un enseignant de l'école. */
export const getTeacherHome = cache((schoolId: string) =>
  api<TeacherHome>(`/schools/${encodeURIComponent(schoolId)}/teacher`),
);
/** Espace parent : 403 si le compte n'est pas un parent de l'école. */
export const getParentHome = cache((schoolId: string) =>
  api<ParentHome>(`/schools/${encodeURIComponent(schoolId)}/parent`),
);
/** Espace élève : 403 si le compte n'est pas un élève de l'école. */
export const getStudentHome = cache((schoolId: string) =>
  api<StudentHome>(`/schools/${encodeURIComponent(schoolId)}/student`),
);
/** Annonces destinées au rôle du compte (enseignant, parent, élève). */
export const getFeed = cache((schoolId: string) =>
  api<Announcement[]>(`/schools/${encodeURIComponent(schoolId)}/announcements/feed`),
);
export const getStructure = cache((schoolId: string) =>
  api<Structure>(`/schools/${encodeURIComponent(schoolId)}/structure`),
);
export const getStudentStats = cache((schoolId: string) =>
  api<StudentStats>(`/schools/${encodeURIComponent(schoolId)}/students/stats`),
);
export const getAttendanceWeek = cache((schoolId: string) =>
  api<AttendanceDay[]>(`/schools/${encodeURIComponent(schoolId)}/attendance/week`),
);
export const getTeacherCount = cache((schoolId: string) =>
  api<{ total: number }>(`/schools/${encodeURIComponent(schoolId)}/teachers/count`).then((r) => r.total),
);
export const getPlans = cache(() => api<Plan[]>("/public/plans", { auth: false }));

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Couleur d'accent de l'école, seulement si son offre l'autorise. */
export function brandColorOf(o: Onboarding): string | null {
  const allowed = o.school.plan?.features.includes("custom_theme");
  return allowed && o.school.brandColor && HEX.test(o.school.brandColor) ? o.school.brandColor : null;
}
