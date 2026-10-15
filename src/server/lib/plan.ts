import pool from "../db.js";

/** Plano Enterprise ativo: plano ENTERPRISE e assinatura não expirada. */
export const hasEnterprise = async (tenantId: number): Promise<boolean> => {
  const { rows } = await pool.query(
    "SELECT subscription_plan, subscription_status, trial_ends_at, subscription_ends_at, is_active FROM tenants WHERE id = $1",
    [tenantId]
  );
  const t = rows[0];
  if (!t || !t.is_active || t.subscription_plan !== "ENTERPRISE") return false;
  const now = new Date();
  if (t.subscription_status === "TRIAL") return !t.trial_ends_at || now <= new Date(t.trial_ends_at);
  if (t.subscription_status === "ACTIVE") return !t.subscription_ends_at || now <= new Date(t.subscription_ends_at);
  return false;
};

/** Middleware: 403 PLAN_REQUIRED para quem não tem Enterprise (usar depois do authMiddleware). */
export const requireEnterprise = async (c: any, next: any) => {
  if (!(await hasEnterprise(c.get("tenantId") as number))) {
    return c.json({ error: "Recurso exclusivo do plano Enterprise", code: "PLAN_REQUIRED" }, 403);
  }
  await next();
};
