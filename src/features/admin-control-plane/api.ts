/**
 * Admin Control Plane API client.
 *
 * Talks to the backend /api/control-plane endpoints using the Supabase
 * session JWT. All authorization is enforced server-side; this client
 * only surfaces results/errors to the UI.
 */
import { apiFetch, API_BASE } from "@/infrastructure/api/client";

const CP = `${API_BASE}/api/control-plane`;

async function cp<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(`${CP}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      detail = j.detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const controlPlaneApi = {
  status: () => cp<{ status: string; maintenance: boolean; active_flags: Record<string, boolean>; site: string }>("/status"),
  // settings
  getSettings: () => cp<{ definitions: unknown[]; values: Record<string, unknown> }>("/settings"),
  updateSetting: (key: string, value: unknown, reason?: string) =>
    cp(`/settings/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ value, reason }),
    }),
  settingHistory: (key: string) => cp<unknown[]>(`/settings/history/${encodeURIComponent(key)}`),
  // feature flags
  getFlags: () => cp<Array<{ key: string; name: string; category: string; enabled: boolean }>>("/feature-flags"),
  setFlag: (key: string, enabled: boolean) =>
    cp(`/feature-flags/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    }),
  // permissions / roles
  getPermissions: () => cp<Array<{ key: string; name: string; category: string }>>("/permissions"),
  getRoles: () => cp<Array<{ id: string; key: string; name: string; permissions: string[] }>>("/roles"),
  getUserRoles: () => cp<unknown[]>("/users/roles"),
  // audit / approvals
  getAudit: (limit = 50) => cp<unknown[]>(`/audit?limit=${limit}`),
  getChangeRequests: (status = "pending") =>
    cp<unknown[]>(`/change-requests?status=${encodeURIComponent(status)}`),
};

// ── Content Control (Stage 29) ──
export const contentApi = {
  list: (resource: string, search?: string) =>
    cp<unknown[]>(`/content/${resource}${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  get: (resource: string, id: string) => cp<unknown>(`/content/${resource}/${id}`),
  create: (resource: string, data: unknown) =>
    cp(`/content/${resource}`, { method: "POST", body: JSON.stringify(data) }),
  update: (resource: string, id: string, data: unknown) =>
    cp(`/content/${resource}/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  publish: (resource: string, id: string) =>
    cp(`/content/${resource}/${id}/publish`, { method: "POST" }),
  unpublish: (resource: string, id: string) =>
    cp(`/content/${resource}/${id}/unpublish`, { method: "POST" }),
  reorder: (resource: string, orderedIds: string[]) =>
    cp(`/content/${resource}/reorder`, { method: "POST", body: JSON.stringify({ ordered_ids: orderedIds }) }),
  delete: (resource: string, id: string) =>
    cp(`/content/${resource}/${id}`, { method: "DELETE" }),
};

// ── User & Access Control (Stage 30) ──
export const accessApi = {
  listUsers: (search?: string, page = 1, pageSize = 25) =>
    cp<{ users: unknown[]; page: number; page_size: number }>(
      `/users?page=${page}&page_size=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}`
    ),
  getUser: (id: string) => cp<unknown>(`/users/${id}`),
  assignRole: (userId: string, roleId: string) =>
    cp(`/users/${userId}/roles/${roleId}`, { method: "POST" }),
  removeRole: (userId: string, roleId: string) =>
    cp(`/users/${userId}/roles/${roleId}`, { method: "DELETE" }),
  blockUser: (userId: string) => cp(`/users/${userId}/block`, { method: "POST" }),
  unblockUser: (userId: string) => cp(`/users/${userId}/unblock`, { method: "POST" }),
  listRolesDetailed: () => cp<unknown[]>("/access/roles"),
  createRole: (key: string, name: string, description?: string) =>
    cp("/access/roles", { method: "POST", body: JSON.stringify({ key, name, description }) }),
  updateRole: (roleId: string, name?: string, description?: string) =>
    cp(`/access/roles/${roleId}`, { method: "PATCH", body: JSON.stringify({ name, description }) }),
  deleteRole: (roleId: string) => cp(`/access/roles/${roleId}`, { method: "DELETE" }),
  setRolePermissions: (roleId: string, permissions: string[]) =>
    cp(`/access/roles/${roleId}/permissions`, { method: "PUT", body: JSON.stringify({ permissions }) }),
};

// ── Enrollment / Access codes / Payments (Stage 31) ──
export const enrollmentApi = {
  listEnrollments: (params?: Record<string, string | number | undefined>) => {
    const q = params ? "?" + Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&") : "";
    return cp<unknown[]>(`/enrollment${q}`);
  },
  grant: (userId: string, chapterId: string) =>
    cp("/enrollment/grant", { method: "POST", body: JSON.stringify({ user_id: userId, chapter_id: chapterId }) }),
  revoke: (accessId: string) => cp(`/enrollment/${accessId}/revoke`, { method: "POST" }),
  restore: (accessId: string) => cp(`/enrollment/${accessId}/restore`, { method: "POST" }),
  listCodes: () => cp<unknown[]>("/enrollment/codes"),
  createCode: (data: Record<string, unknown>) =>
    cp("/enrollment/codes", { method: "POST", body: JSON.stringify(data) }),
  setCodeActive: (id: string, active: boolean) =>
    cp(`/enrollment/codes/${id}/${active ? "activate" : "deactivate"}`, { method: "POST" }),
  codeRedemptions: (id: string) => cp<unknown[]>(`/enrollment/codes/${id}/redemptions`),
  listPayments: (status = "pending") => cp<unknown[]>(`/enrollment/payments?status=${status}`),
  approvePayment: (id: string) => cp(`/enrollment/payments/${id}/approve`, { method: "POST" }),
  rejectPayment: (id: string, reason?: string) =>
    cp(`/enrollment/payments/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
};

// ── Telegram & Video Storage (Stage 32) ──
export const telegramApi = {
  status: () => cp<Record<string, unknown>>("/telegram/status"),
  diagnostics: () => cp<Record<string, unknown>>("/telegram/diagnostics"),
  webhook: () => cp<Record<string, unknown>>("/telegram/webhook"),
  reinitWebhook: () => cp("/telegram/webhook/reinitialize", { method: "POST" }),
  listVideos: (missing?: boolean) =>
    cp<{ videos: unknown[] }>(`/telegram/videos${missing != null ? `?missing=${missing}` : ""}`),
  getVideo: (id: string) => cp<Record<string, unknown>>(`/telegram/videos/${id}`),
  verifyVideo: (id: string) => cp<Record<string, unknown>>(`/telegram/videos/${id}/verify`),
  setMapping: (id: string, data: Record<string, unknown>) =>
    cp(`/telegram/videos/${id}/mapping`, { method: "PUT", body: JSON.stringify(data) }),
  clearMapping: (id: string) => cp(`/telegram/videos/${id}/mapping`, { method: "DELETE" }),
  storageDiagnostics: () => cp<Record<string, unknown>>("/telegram/storage/diagnostics"),
};

// ── Streaming & Playback (Stage 33) ──
export const streamingApi = {
  status: () => cp<Record<string, unknown>>("/streaming/status"),
  listVideos: (status?: string) =>
    cp<{ videos: unknown[] }>(`/streaming/videos${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  videoDiagnostics: (id: string) => cp<Record<string, unknown>>(`/streaming/videos/${id}/diagnostics`),
  getSettings: () => cp<Record<string, unknown>>("/streaming/settings"),
  updateSetting: (key: string, value: unknown) =>
    cp(`/streaming/settings/${encodeURIComponent(key)}`, { method: "PUT", body: JSON.stringify({ value }) }),
};

// ── Operations & System (Stage 34) ──
export const operationsApi = {
  status: () => cp<Record<string, unknown>>("/operations/status"),
  diagnostics: () => cp<Record<string, unknown>>("/operations/diagnostics"),
  configuration: () => cp<Record<string, unknown>>("/operations/configuration"),
  deployment: () => cp<Record<string, unknown>>("/operations/deployment"),
  backups: () => cp<Record<string, unknown>>("/operations/backups"),
  monitoring: () => cp<Record<string, unknown>>("/operations/monitoring"),
  setMaintenance: (enabled: boolean) =>
    cp("/operations/maintenance", { method: "POST", body: JSON.stringify({ enabled }) }),
  reinitTelegram: () => cp("/operations/telegram/reinitialize", { method: "POST" }),
};

// ── Governance: Approvals, Audit, Security, Backups, Deployment (Stage 35) ──
export const approvalsApi = {
  list: (params?: Record<string, string>) => {
    const q = params ? "?" + Object.entries(params).map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join("&") : "";
    return cp<unknown[]>(`/approvals${q}`);
  },
  get: (id: string) => cp<unknown>(`/approvals/${id}`),
  create: (data: Record<string, unknown>) => cp("/approvals", { method: "POST", body: JSON.stringify(data) }),
  approve: (id: string) => cp(`/approvals/${id}/approve`, { method: "POST" }),
  reject: (id: string, reason?: string) => cp(`/approvals/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  cancel: (id: string) => cp(`/approvals/${id}/cancel`, { method: "POST" }),
  execute: (id: string) => cp(`/approvals/${id}/execute`, { method: "POST" }),
};
export const auditApi = {
  list: (params?: Record<string, string|number>) => {
    const q = params ? "?" + Object.entries(params).map(([k,v])=>`${k}=${encodeURIComponent(String(v))}`).join("&") : "";
    return cp<unknown[]>(`/audit${q}`);
  },
  exportUrl: "/api/control-plane/audit/export",
  settingsHistory: (key?: string) => cp<unknown[]>(`/settings/history${key ? `?key=${encodeURIComponent(key)}` : ""}`),
  rollback: (versionId: string) => cp("/settings/rollback", { method: "POST", body: JSON.stringify({ version_id: versionId }) }),
};
export const securityApi = {
  posture: () => cp<Record<string, unknown>>("/security/posture"),
};
export const readinessApi = {
  backups: () => cp<Record<string, unknown>>("/backups/status"),
  deployment: () => cp<Record<string, unknown>>("/deployment/readiness"),
};
