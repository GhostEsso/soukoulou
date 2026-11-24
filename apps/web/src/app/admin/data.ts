import "server-only";
import { cache } from "react";
import { api } from "@/lib/api";
import type { Alert, Payment, Payout, SubscriptionStatus, VerificationStatus } from "@/lib/types";

export interface VerificationRow {
  id: string;
  name: string;
  city: string;
  country: string;
  type: string;
  verificationStatus: VerificationStatus;
  updatedAt: string;
  plan: { code: string; name: string } | null;
  _count: { documents: number };
}

export interface SchoolRow {
  id: string;
  name: string;
  slug: string | null;
  city: string;
  country: string;
  subscriptionStatus: SubscriptionStatus;
  verificationStatus: VerificationStatus;
  subscriptionEndsAt: string | null;
  plan: { code: string; name: string } | null;
  createdAt: string;
}

export type PendingTransfer = Payment & {
  school: { id: string; name: string; city: string };
  plan: { name: string };
};

// Dédupliqués entre le layout (badges) et les pages.
export const getAlerts = cache((unread: boolean) =>
  api<{ unread: number; items: Alert[] }>(`/platform/alerts${unread ? "?unread=true" : ""}`),
);
export const getVerifications = cache((status: VerificationStatus) =>
  api<VerificationRow[]>(`/platform/verifications?status=${status}`),
);
export const getPendingTransfers = cache(() => api<PendingTransfer[]>("/platform/payments/pending-transfers"));
export const getPendingPayouts = cache(() => api<Payout[]>("/platform/payouts?status=REQUESTED"));
