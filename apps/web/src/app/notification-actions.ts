"use server";

import { api } from "@/lib/api";

/** Cloche ouverte : tout est lu. Échec sans conséquence (la cloche reste simplement non lue). */
export async function markNotificationsRead(schoolId: string) {
  await api(`/schools/${encodeURIComponent(schoolId)}/notifications/read`, { method: "POST" }).catch(() => undefined);
}
