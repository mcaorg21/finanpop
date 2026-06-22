import "dotenv/config";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import pool from "./db.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type Variables = {
  currentUser: UserInfo;
  tenantId: number;
};

const app = new Hono<{ Variables: Variables }>();

type UserInfo = {
  id: number;
  name: string;
  username: string;
  tenant_id: number;
};

const SESSION_COOKIE = "secretaria_session";
const ADMIN_SESSION_COOKIE = "secretaria_admin_session";

const getCurrentUser = async (sessionCookie: string | undefined): Promise<UserInfo | null> => {
  if (!sessionCookie) return null;
  const userId = sessionCookie.replace("user_", "");
  const { rows } = await pool.query(
    "SELECT id, name, username, tenant_id FROM users WHERE id = $1 AND is_active = true",
    [userId]
  );
  return rows[0] || null;
};

const authMiddleware = async (c: any, next: any) => {
  const session = getCookie(c, SESSION_COOKIE);
  const user = await getCurrentUser(session);
  if (!user) return c.json({ error: "Não autorizado" }, 401);
  c.set("currentUser", user);
  c.set("tenantId", user.tenant_id);
  await next();
};

const adminAuthMiddleware = async (c: any, next: any) => {
  const session = getCookie(c, ADMIN_SESSION_COOKIE);
  if (!session) return c.json({ error: "Não autorizado" }, 401);
  const adminId = session.replace("admin_", "");
  const { rows } = await pool.query(
    "SELECT id, name, email FROM admins WHERE id = $1 AND is_active = true",
    [adminId]
  );
  if (!rows[0]) return c.json({ error: "Não autorizado" }, 401);
  await next();
};

// Email transporter
const getEmailTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// ============ AUTH ============

app.post("/api/auth/login", async (c) => {
  const { username, password } = await c.req.json();
  const { rows } = await pool.query(
    `SELECT u.*, t.subscription_status FROM users u
     JOIN tenants t ON u.tenant_id = t.id
     WHERE u.username = $1 AND u.password = $2 AND u.is_active = true AND t.is_active = true`,
    [username, password]
  );
  const user = rows[0];
  if (user) {
    setCookie(c, SESSION_COOKIE, `user_${user.id}`, {
      httpOnly: true,
      path: "/",
      sameSite: "None",
      secure: true,
      maxAge: 60 * 60 * 24 * 7,
    });
    return c.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        tenant_id: user.tenant_id,
        subscription_status: user.subscription_status,
      },
    });
  }
  return c.json({ error: "Usuário ou senha inválidos" }, 401);
});

app.post("/api/auth/send-code", async (c) => {
  const { email } = await c.req.json();
  if (!email || !email.includes("@")) return c.json({ error: "Email inválido" }, 400);

  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    await pool.query(
      `INSERT INTO verification_requests (email, code, expires_at, created_at) VALUES ($1, $2, $3, $4)`,
      [email, code, expiresAt.toISOString(), new Date().toISOString()]
    );

    const transporter = getEmailTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_FROM || "noreply@finanpop.com",
      to: email,
      subject: "FinanPOP - Código de Verificação",
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin: 0; padding: 40px 20px; background-color: #f4f4f5; font-family: Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px;">
            <div style="padding: 32px 40px 24px 40px; border-bottom: 1px solid #e4e4e7;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b;">Código de Verificação</h1>
            </div>
            <div style="padding: 32px 40px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
                Seu código de verificação para criar conta no FinanPOP é:
              </p>
              <div style="background-color: #f4f4f5; padding: 20px; border-radius: 8px; text-align: center; margin: 24px 0;">
                <span style="font-size: 32px; font-weight: 700; color: #18181b; letter-spacing: 8px;">${code}</span>
              </div>
              <p style="margin: 0; font-size: 14px; line-height: 20px; color: #71717a;">
                Este código expira em 10 minutos.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Seu código de verificação: ${code}. Expira em 10 minutos.`,
    });

    return c.json({ success: true, message: "Código enviado para seu email" });
  } catch (error: any) {
    console.error("Send code error:", error);
    return c.json({ error: "Erro ao enviar código. Tente novamente." }, 500);
  }
});

app.post("/api/auth/verify-code", async (c) => {
  const { email, code } = await c.req.json();
  if (!email || !code) return c.json({ error: "Email e código são obrigatórios" }, 400);

  try {
    const { rows } = await pool.query(
      `SELECT * FROM verification_requests
       WHERE email = $1 AND code = $2 AND expires_at > $3 AND verified = false
       ORDER BY created_at DESC LIMIT 1`,
      [email, code, new Date().toISOString()]
    );
    if (!rows[0]) return c.json({ error: "Código inválido ou expirado" }, 400);

    await pool.query(`UPDATE verification_requests SET verified = true WHERE id = $1`, [rows[0].id]);
    return c.json({ success: true, message: "Email verificado com sucesso" });
  } catch (error: any) {
    console.error("Verify code error:", error);
    return c.json({ error: "Erro ao verificar código." }, 500);
  }
});

// ============ ADMIN AUTH ============

app.post("/api/admin/login", async (c) => {
  const { email, password } = await c.req.json();
  const { rows } = await pool.query(
    "SELECT * FROM admins WHERE email = $1 AND password = $2 AND is_active = true",
    [email, password]
  );
  const admin = rows[0];
  if (admin) {
    setCookie(c, ADMIN_SESSION_COOKIE, `admin_${admin.id}`, {
      httpOnly: true,
      path: "/",
      sameSite: "None",
      secure: true,
      maxAge: 60 * 60 * 24 * 7,
    });
    return c.json({ success: true, admin: { id: admin.id, name: admin.name, email: admin.email } });
  }
  return c.json({ error: "Email ou senha inválidos" }, 401);
});

app.post("/api/admin/logout", async (c) => {
  deleteCookie(c, ADMIN_SESSION_COOKIE, { path: "/" });
  return c.json({ success: true });
});

app.get("/api/admin/me", adminAuthMiddleware, async (c) => {
  const session = getCookie(c, ADMIN_SESSION_COOKIE);
  const adminId = session?.replace("admin_", "");
  const { rows } = await pool.query("SELECT id, name, email FROM admins WHERE id = $1", [adminId]);
  if (rows[0]) return c.json(rows[0]);
  return c.json({ error: "Admin não encontrado" }, 404);
});

app.get("/api/admin/tenants", adminAuthMiddleware, async (c) => {
  const { rows } = await pool.query("SELECT * FROM tenants ORDER BY created_at DESC");
  return c.json(rows);
});

app.put("/api/admin/tenants/:id", adminAuthMiddleware, async (c) => {
  const id = c.req.param("id");
  const { subscription_status, subscription_plan, subscription_ends_at, is_active } = await c.req.json();
  await pool.query(
    `UPDATE tenants SET subscription_status = $1, subscription_plan = $2, subscription_ends_at = $3,
     trial_ends_at = $4, is_active = $5, updated_at = NOW() WHERE id = $6`,
    [subscription_status, subscription_plan, subscription_ends_at, subscription_ends_at, is_active, id]
  );
  return c.json({ success: true });
});

// ============ USER AUTH ============

app.post("/api/auth/register", async (c) => {
  const { company_type, company_name, cnpj, admin_name, username, password, email, verification_code } = await c.req.json();

  if (!company_type || !company_name || !admin_name || !username || !password || !email || !verification_code) {
    return c.json({ error: "Todos os campos são obrigatórios" }, 400);
  }
  if (password.length < 6) return c.json({ error: "A senha deve ter no mínimo 6 caracteres" }, 400);
  if (company_type === "PJ" && !cnpj) return c.json({ error: "CNPJ é obrigatório para pessoa jurídica" }, 400);

  const { rows: verRows } = await pool.query(
    `SELECT * FROM verification_requests WHERE email = $1 AND code = $2 AND verified = true AND expires_at > $3 ORDER BY created_at DESC LIMIT 1`,
    [email, verification_code, new Date().toISOString()]
  );
  if (!verRows[0]) return c.json({ error: "Email não verificado. Solicite um novo código." }, 400);
  if (username !== email) return c.json({ error: "O login deve ser o email verificado" }, 400);
  if (email !== verRows[0].email) return c.json({ error: "Email não corresponde ao email verificado" }, 400);

  const { rows: existUser } = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
  if (existUser[0]) return c.json({ error: "Este nome de usuário já está em uso" }, 400);

  const { rows: existEmail } = await pool.query("SELECT id FROM tenants WHERE email = $1", [email]);
  if (existEmail[0]) return c.json({ error: "Este email já está cadastrado" }, 400);

  try {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 5);

    const { rows: tenantRows } = await pool.query(
      `INSERT INTO tenants (name, email, company_type, cnpj, subscription_status, subscription_plan, trial_ends_at, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [company_name, email, company_type, cnpj || null, "TRIAL", "FREE", trialEndsAt.toISOString(), true]
    );
    const tenantId = tenantRows[0].id;

    await pool.query(
      `INSERT INTO users (name, username, password, is_active, tenant_id) VALUES ($1, $2, $3, $4, $5)`,
      [admin_name, username, password, true, tenantId]
    );

    return c.json({ success: true, message: "Cadastro realizado com sucesso! Faça login para acessar o sistema." }, 201);
  } catch (error: any) {
    console.error("Registration error:", error);
    return c.json({ error: "Erro ao criar conta. Tente novamente." }, 500);
  }
});

app.post("/api/auth/logout", async (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ success: true });
});

app.get("/api/auth/me", authMiddleware, async (c) => {
  const user = c.get("currentUser") as UserInfo;
  const { rows } = await pool.query(
    "SELECT subscription_status, subscription_plan FROM tenants WHERE id = $1",
    [user.tenant_id]
  );
  const tenant = rows[0];
  return c.json({
    id: user.id,
    name: user.name,
    username: user.username,
    tenant_id: user.tenant_id,
    subscription_status: tenant?.subscription_status,
    subscription_plan: tenant?.subscription_plan,
  });
});

app.get("/api/tenant/subscription", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const { rows } = await pool.query(
    "SELECT name, company_type, cnpj, subscription_status, subscription_plan, trial_ends_at, subscription_ends_at FROM tenants WHERE id = $1",
    [tenantId]
  );
  const tenant = rows[0];
  if (!tenant) return c.json({ error: "Tenant não encontrado" }, 404);

  const now = new Date();
  let needsUpdate = false;

  if (tenant.subscription_status === "TRIAL" && tenant.trial_ends_at) {
    if (now > new Date(tenant.trial_ends_at)) {
      tenant.subscription_status = "EXPIRED";
      needsUpdate = true;
    }
  } else if (tenant.subscription_status === "ACTIVE" && tenant.subscription_ends_at) {
    if (now > new Date(tenant.subscription_ends_at)) {
      tenant.subscription_status = "EXPIRED";
      needsUpdate = true;
    }
  }

  if (needsUpdate) {
    await pool.query("UPDATE tenants SET subscription_status = $1 WHERE id = $2", ["EXPIRED", tenantId]);
  }

  return c.json(tenant);
});

app.post("/api/tenant/create-payment-link", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  try {
    const response = await fetch("https://api.asaas.com/v3/paymentLinks", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        access_token: process.env.ASAAS_API_KEY || "",
        "User-Agent": "FinanPOP/1.0",
      },
      body: JSON.stringify({
        billingType: "CREDIT_CARD",
        chargeType: "RECURRENT",
        subscriptionCycle: "MONTHLY",
        maxInstallmentCount: 12,
        externalReference: tenantId.toString(),
        isAddressRequired: false,
        notificationEnabled: true,
        name: "Assinatura FinanPOP - Hub Controle Financeiro",
        value: 7.9,
      }),
    });
    if (!response.ok) {
      console.error("Asaas API error:", await response.text());
      return c.json({ error: "Erro ao criar link de pagamento" }, 500);
    }
    const data = (await response.json()) as any;
    return c.json({ url: data.url });
  } catch (error) {
    console.error("Error creating payment link:", error);
    return c.json({ error: "Erro ao criar link de pagamento" }, 500);
  }
});

app.post("/api/payment/callback", async (c) => {
  try {
    const body = (await c.req.json()) as any;
    const tenantId = body.externalReference;
    if (!tenantId) return c.json({ error: "Tenant ID não encontrado" }, 400);

    const subscriptionEndsAt = new Date();
    subscriptionEndsAt.setFullYear(subscriptionEndsAt.getFullYear() + 1);

    await pool.query(
      `UPDATE tenants SET subscription_plan = $1, subscription_status = $2, subscription_ends_at = $3 WHERE id = $4`,
      ["BASICO", "ACTIVE", subscriptionEndsAt.toISOString(), tenantId]
    );
    return c.json({ success: true });
  } catch (error) {
    console.error("Error processing payment callback:", error);
    return c.json({ error: "Erro ao processar callback" }, 500);
  }
});

// ============ USERS ============

app.get("/api/users", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const { rows: mainRows } = await pool.query(
    "SELECT id FROM users WHERE tenant_id = $1 ORDER BY id ASC LIMIT 1",
    [tenantId]
  );
  const mainUserId = mainRows[0]?.id;
  const { rows } = await pool.query(
    "SELECT id, name, username, is_active, created_at FROM users WHERE tenant_id = $1 ORDER BY name ASC",
    [tenantId]
  );
  return c.json(rows.map((u: any) => ({ ...u, is_main_user: u.id === mainUserId })));
});

app.post("/api/users", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const { name, username, password } = await c.req.json();
  if (!name || !username || !password) return c.json({ error: "Nome, login e senha são obrigatórios" }, 400);

  const { rows: existing } = await pool.query(
    "SELECT id FROM users WHERE username = $1 AND tenant_id = $2",
    [username, tenantId]
  );
  if (existing[0]) return c.json({ error: "Este login já está em uso" }, 400);

  const { rows } = await pool.query(
    `INSERT INTO users (name, username, password, tenant_id) VALUES ($1, $2, $3, $4) RETURNING id`,
    [name, username, password, tenantId]
  );
  return c.json({ id: rows[0].id, success: true }, 201);
});

app.put("/api/users/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const id = c.req.param("id");
  const { name, username, password, is_active } = await c.req.json();
  if (!name || !username) return c.json({ error: "Nome e login são obrigatórios" }, 400);

  const { rows: existing } = await pool.query(
    "SELECT id FROM users WHERE username = $1 AND id != $2 AND tenant_id = $3",
    [username, id, tenantId]
  );
  if (existing[0]) return c.json({ error: "Este login já está em uso" }, 400);

  if (password) {
    await pool.query(
      `UPDATE users SET name = $1, username = $2, password = $3, is_active = $4, updated_at = NOW() WHERE id = $5 AND tenant_id = $6`,
      [name, username, password, is_active !== false, id, tenantId]
    );
  } else {
    await pool.query(
      `UPDATE users SET name = $1, username = $2, is_active = $3, updated_at = NOW() WHERE id = $4 AND tenant_id = $5`,
      [name, username, is_active !== false, id, tenantId]
    );
  }
  return c.json({ success: true });
});

app.delete("/api/users/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const id = c.req.param("id");

  const { rows: mainRows } = await pool.query(
    "SELECT id FROM users WHERE tenant_id = $1 ORDER BY id ASC LIMIT 1",
    [tenantId]
  );
  if (mainRows[0] && mainRows[0].id === parseInt(id)) {
    return c.json({ error: "Não é possível excluir o usuário principal que criou a conta" }, 400);
  }

  const { rows: countRows } = await pool.query(
    "SELECT COUNT(*) as count FROM users WHERE is_active = true AND tenant_id = $1",
    [tenantId]
  );
  if (parseInt(countRows[0].count) <= 1) {
    return c.json({ error: "Não é possível excluir o último usuário ativo" }, 400);
  }

  await pool.query("DELETE FROM users WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  return c.json({ success: true });
});

// ============ HOMES ============

app.get("/api/homes", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const { rows } = await pool.query("SELECT * FROM homes WHERE tenant_id = $1 ORDER BY name ASC", [tenantId]);
  return c.json(rows);
});

app.get("/api/homes/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const id = c.req.param("id");
  const { rows } = await pool.query("SELECT * FROM homes WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  if (!rows[0]) return c.json({ error: "Centro de Custo não encontrado" }, 404);
  return c.json(rows[0]);
});

app.post("/api/homes", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const { name, street, number, complement, neighborhood, city, state, zip, notes } = await c.req.json();
  if (!name) return c.json({ error: "Nome é obrigatório" }, 400);

  const { rows } = await pool.query(
    `INSERT INTO homes (name, street, number, complement, neighborhood, city, state, zip, notes, tenant_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [name, street || null, number || null, complement || null, neighborhood || null, city || null, state || null, zip || null, notes || null, tenantId]
  );
  return c.json({ id: rows[0].id, success: true }, 201);
});

app.put("/api/homes/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const id = c.req.param("id");
  const { name, street, number, complement, neighborhood, city, state, zip, notes } = await c.req.json();
  if (!name) return c.json({ error: "Nome é obrigatório" }, 400);

  await pool.query(
    `UPDATE homes SET name=$1, street=$2, number=$3, complement=$4, neighborhood=$5, city=$6, state=$7, zip=$8, notes=$9, updated_at=NOW() WHERE id=$10 AND tenant_id=$11`,
    [name, street || null, number || null, complement || null, neighborhood || null, city || null, state || null, zip || null, notes || null, id, tenantId]
  );
  return c.json({ success: true });
});

app.delete("/api/homes/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const id = c.req.param("id");
  await pool.query("DELETE FROM homes WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  return c.json({ success: true });
});

// ============ EMPLOYEES ============

app.get("/api/employees", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const { rows } = await pool.query("SELECT * FROM employees WHERE tenant_id = $1 ORDER BY name ASC", [tenantId]);
  return c.json(rows);
});

app.get("/api/employees/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const id = c.req.param("id");
  const { rows } = await pool.query("SELECT * FROM employees WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  if (!rows[0]) return c.json({ error: "Funcionário não encontrado" }, 404);
  return c.json(rows[0]);
});

app.post("/api/employees", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const { name, role, phone, document, notes, is_active, work_schedule, ctps_numero, ctps_serie, admission_date, saturday_schedule, weekly_rest, hours_per_day } = await c.req.json();
  if (!name) return c.json({ error: "Nome é obrigatório" }, 400);

  const { rows } = await pool.query(
    `INSERT INTO employees (name, role, phone, document, notes, is_active, work_schedule, ctps_numero, ctps_serie, admission_date, saturday_schedule, weekly_rest, hours_per_day, tenant_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
    [name, role || null, phone || null, document || null, notes || null, is_active !== false, work_schedule || null, ctps_numero || null, ctps_serie || null, admission_date || null, saturday_schedule || null, weekly_rest || null, hours_per_day || "8:48:00", tenantId]
  );
  return c.json({ id: rows[0].id, success: true }, 201);
});

app.put("/api/employees/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const id = c.req.param("id");
  const { name, role, phone, document, notes, is_active, work_schedule, ctps_numero, ctps_serie, admission_date, saturday_schedule, weekly_rest, hours_per_day } = await c.req.json();
  if (!name) return c.json({ error: "Nome é obrigatório" }, 400);

  await pool.query(
    `UPDATE employees SET name=$1, role=$2, phone=$3, document=$4, notes=$5, is_active=$6, work_schedule=$7, ctps_numero=$8, ctps_serie=$9, admission_date=$10, saturday_schedule=$11, weekly_rest=$12, hours_per_day=$13, updated_at=NOW() WHERE id=$14 AND tenant_id=$15`,
    [name, role || null, phone || null, document || null, notes || null, is_active ? true : false, work_schedule || null, ctps_numero || null, ctps_serie || null, admission_date || null, saturday_schedule || null, weekly_rest || null, hours_per_day || "8:48:00", id, tenantId]
  );
  return c.json({ success: true });
});

app.delete("/api/employees/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const id = c.req.param("id");
  await pool.query("UPDATE employees SET is_active = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  return c.json({ success: true });
});

// ============ PIX KEYS ============

app.get("/api/employees/:id/pix-keys", authMiddleware, async (c) => {
  const employeeId = c.req.param("id");
  const { rows } = await pool.query("SELECT * FROM pix_keys WHERE employee_id = $1 ORDER BY is_primary DESC, id ASC", [employeeId]);
  return c.json(rows);
});

app.post("/api/employees/:id/pix-keys", authMiddleware, async (c) => {
  const employeeId = c.req.param("id");
  const { key_type, key_value, is_primary } = await c.req.json();
  if (!key_type || !key_value) return c.json({ error: "Tipo e valor da chave são obrigatórios" }, 400);

  if (is_primary) {
    await pool.query("UPDATE pix_keys SET is_primary = false WHERE employee_id = $1", [employeeId]);
  }
  const { rows } = await pool.query(
    `INSERT INTO pix_keys (employee_id, key_type, key_value, is_primary) VALUES ($1, $2, $3, $4) RETURNING id`,
    [employeeId, key_type, key_value, is_primary ? true : false]
  );
  return c.json({ id: rows[0].id, success: true }, 201);
});

app.put("/api/pix-keys/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const { key_type, key_value, is_primary } = await c.req.json();

  const { rows: existing } = await pool.query("SELECT employee_id FROM pix_keys WHERE id = $1", [id]);
  if (!existing[0]) return c.json({ error: "Chave PIX não encontrada" }, 404);

  if (is_primary) {
    await pool.query("UPDATE pix_keys SET is_primary = false WHERE employee_id = $1", [existing[0].employee_id]);
  }
  await pool.query(
    `UPDATE pix_keys SET key_type=$1, key_value=$2, is_primary=$3, updated_at=NOW() WHERE id=$4`,
    [key_type, key_value, is_primary ? true : false, id]
  );
  return c.json({ success: true });
});

app.delete("/api/pix-keys/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  await pool.query("DELETE FROM pix_keys WHERE id = $1", [id]);
  return c.json({ success: true });
});

// ============ COMPANIES ============

app.get("/api/companies", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const { rows } = await pool.query("SELECT * FROM companies WHERE tenant_id = $1 ORDER BY name ASC", [tenantId]);
  return c.json(rows);
});

app.get("/api/companies/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const id = c.req.param("id");
  const { rows } = await pool.query("SELECT * FROM companies WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  if (!rows[0]) return c.json({ error: "Empresa não encontrada" }, 404);
  return c.json(rows[0]);
});

app.post("/api/companies", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const { name, cnpj, phone, email, notes, is_active } = await c.req.json();
  if (!name) return c.json({ error: "Nome é obrigatório" }, 400);

  const { rows } = await pool.query(
    `INSERT INTO companies (name, cnpj, phone, email, notes, is_active, tenant_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [name, cnpj || null, phone || null, email || null, notes || null, is_active !== false, tenantId]
  );
  return c.json({ id: rows[0].id, success: true }, 201);
});

app.put("/api/companies/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const id = c.req.param("id");
  const { name, cnpj, phone, email, notes, is_active } = await c.req.json();
  if (!name) return c.json({ error: "Nome é obrigatório" }, 400);

  await pool.query(
    `UPDATE companies SET name=$1, cnpj=$2, phone=$3, email=$4, notes=$5, is_active=$6, updated_at=NOW() WHERE id=$7 AND tenant_id=$8`,
    [name, cnpj || null, phone || null, email || null, notes || null, is_active ? true : false, id, tenantId]
  );
  return c.json({ success: true });
});

app.delete("/api/companies/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const id = c.req.param("id");
  await pool.query("DELETE FROM companies WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  return c.json({ success: true });
});

// ============ CATEGORIES ============

app.get("/api/categories", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const { rows } = await pool.query("SELECT * FROM categories WHERE tenant_id = $1 ORDER BY kind ASC, name ASC", [tenantId]);
  return c.json(rows);
});

app.get("/api/categories/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const id = c.req.param("id");
  const { rows } = await pool.query("SELECT * FROM categories WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  if (!rows[0]) return c.json({ error: "Categoria não encontrada" }, 404);
  return c.json(rows[0]);
});

app.post("/api/categories", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const { name, kind, notes, parent_id } = await c.req.json();
  if (!name || !kind) return c.json({ error: "Nome e tipo são obrigatórios" }, 400);
  if (kind !== "REVENUE" && kind !== "EXPENSE") return c.json({ error: "Tipo deve ser REVENUE ou EXPENSE" }, 400);

  const { rows } = await pool.query(
    `INSERT INTO categories (name, kind, notes, parent_id, tenant_id) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [name, kind, notes || null, parent_id || null, tenantId]
  );
  return c.json({ id: rows[0].id, success: true }, 201);
});

app.put("/api/categories/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const id = c.req.param("id");
  const { name, kind, notes, parent_id } = await c.req.json();
  if (!name || !kind) return c.json({ error: "Nome e tipo são obrigatórios" }, 400);
  if (parent_id && Number(parent_id) === Number(id)) return c.json({ error: "Uma categoria não pode ser sua própria subcategoria" }, 400);

  await pool.query(
    `UPDATE categories SET name=$1, kind=$2, notes=$3, parent_id=$4, updated_at=NOW() WHERE id=$5 AND tenant_id=$6`,
    [name, kind, notes || null, parent_id || null, id, tenantId]
  );
  return c.json({ success: true });
});

app.delete("/api/categories/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const id = c.req.param("id");

  const { rows: txCheck } = await pool.query(
    "SELECT COUNT(*) as count FROM transactions WHERE category_id = $1 AND tenant_id = $2",
    [id, tenantId]
  );
  if (parseInt(txCheck[0].count) > 0) {
    return c.json({ error: `Não é possível excluir esta categoria pois existem ${txCheck[0].count} lançamento(s) vinculado(s) a ela.` }, 400);
  }

  const { rows: subCheck } = await pool.query(
    `SELECT COUNT(DISTINCT t.id) as count FROM categories c JOIN transactions t ON t.category_id = c.id WHERE c.parent_id = $1 AND c.tenant_id = $2 AND t.tenant_id = $3`,
    [id, tenantId, tenantId]
  );
  if (parseInt(subCheck[0].count) > 0) {
    return c.json({ error: `Não é possível excluir esta categoria pois suas subcategorias possuem ${subCheck[0].count} lançamento(s) vinculado(s).` }, 400);
  }

  await pool.query("DELETE FROM categories WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  return c.json({ success: true });
});

// ============ TRANSACTIONS ============

app.get("/api/transactions", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const { start_date, end_date, home_id, employee_id, category_id, type, status } = c.req.query();

  let sql = `SELECT t.*, h.name as home_name,
             CASE WHEN pc.name IS NOT NULL THEN pc.name || ' > ' || c.name ELSE c.name END as category_name,
             e.name as employee_name,
             co.name as company_name,
             (SELECT COUNT(*) FROM attachments a WHERE a.transaction_id = t.id) as attachment_count
             FROM transactions t
             LEFT JOIN homes h ON t.home_id = h.id
             LEFT JOIN categories c ON t.category_id = c.id
             LEFT JOIN categories pc ON c.parent_id = pc.id
             LEFT JOIN employees e ON t.employee_id = e.id
             LEFT JOIN companies co ON t.company_id = co.id
             WHERE t.tenant_id = $1`;
  const params: any[] = [tenantId];
  let paramIdx = 2;

  if (start_date) { sql += ` AND t.date >= $${paramIdx++}`; params.push(start_date); }
  if (end_date) { sql += ` AND t.date <= $${paramIdx++}`; params.push(end_date); }
  if (home_id) { sql += ` AND t.home_id = $${paramIdx++}`; params.push(home_id); }
  if (employee_id) { sql += ` AND t.employee_id = $${paramIdx++}`; params.push(employee_id); }
  if (c.req.query("company_id")) { sql += ` AND t.company_id = $${paramIdx++}`; params.push(c.req.query("company_id")); }
  if (category_id) { sql += ` AND t.category_id = $${paramIdx++}`; params.push(category_id); }
  if (type) { sql += ` AND t.type = $${paramIdx++}`; params.push(type); }
  if (status) { sql += ` AND t.status = $${paramIdx++}`; params.push(status); }

  sql += " ORDER BY t.date DESC, t.id DESC";

  const { rows } = await pool.query(sql, params);
  return c.json(rows);
});

app.post("/api/transactions", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const { date, type, amount, home_id, category_id, employee_id, company_id, payment_method, status, description, notes, due_date, payment_date } = await c.req.json();

  if (!date || !type || !amount || !home_id || !category_id || !payment_method) {
    return c.json({ error: "Campos obrigatórios: data, tipo, valor, centro de custo, categoria e forma de pagamento" }, 400);
  }

  const { rows } = await pool.query(
    `INSERT INTO transactions (date, type, amount, home_id, category_id, employee_id, company_id, payment_method, status, description, notes, due_date, payment_date, tenant_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
    [date, type, amount, home_id, category_id, employee_id || null, company_id || null, payment_method, status || "PENDING", description || null, notes || null, due_date || null, payment_date || null, tenantId]
  );
  return c.json({ id: rows[0].id, success: true }, 201);
});

app.put("/api/transactions/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const id = c.req.param("id");
  const { date, type, amount, home_id, category_id, employee_id, company_id, payment_method, status, description, notes, due_date, payment_date } = await c.req.json();

  await pool.query(
    `UPDATE transactions SET date=$1, type=$2, amount=$3, home_id=$4, category_id=$5, employee_id=$6, company_id=$7, payment_method=$8, status=$9, description=$10, notes=$11, due_date=$12, payment_date=$13, updated_at=NOW() WHERE id=$14 AND tenant_id=$15`,
    [date, type, amount, home_id, category_id, employee_id || null, company_id || null, payment_method, status, description || null, notes || null, due_date || null, payment_date || null, id, tenantId]
  );
  return c.json({ success: true });
});

app.delete("/api/transactions/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const id = c.req.param("id");
  await pool.query("DELETE FROM transactions WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  return c.json({ success: true });
});

// ============ STATS ============

app.get("/api/stats", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const [homes, employees, categories, transactions, revenue, expense] = await Promise.all([
    pool.query("SELECT COUNT(*) as count FROM homes WHERE tenant_id = $1", [tenantId]),
    pool.query("SELECT COUNT(*) as count FROM employees WHERE is_active = true AND tenant_id = $1", [tenantId]),
    pool.query("SELECT COUNT(*) as count FROM categories WHERE tenant_id = $1", [tenantId]),
    pool.query("SELECT COUNT(*) as count FROM transactions WHERE date >= $1 AND date <= $2 AND tenant_id = $3", [startOfMonth, endOfMonth, tenantId]),
    pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'REVENUE' AND status != 'CANCELED' AND date >= $1 AND date <= $2 AND tenant_id = $3", [startOfMonth, endOfMonth, tenantId]),
    pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'EXPENSE' AND status != 'CANCELED' AND date >= $1 AND date <= $2 AND tenant_id = $3", [startOfMonth, endOfMonth, tenantId]),
  ]);

  return c.json({
    centrosCusto: parseInt(homes.rows[0].count),
    funcionarios: parseInt(employees.rows[0].count),
    categorias: parseInt(categories.rows[0].count),
    lancamentos: parseInt(transactions.rows[0].count),
    receitas: parseFloat(revenue.rows[0].total),
    despesas: parseFloat(expense.rows[0].total),
    saldo: parseFloat(revenue.rows[0].total) - parseFloat(expense.rows[0].total),
  });
});

// ============ REPORTS ============

app.get("/api/reports", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const { start_date, end_date, due_date_start, due_date_end, employee_id, company_id, type, status } = c.req.query();
  const homeIdsParam = c.req.queries("home_ids[]") || [];
  const categoryIdsParam = c.req.queries("category_ids[]") || [];

  let whereClause = "WHERE t.tenant_id = $1";
  const params: any[] = [tenantId];
  let paramIdx = 2;

  if (start_date) { whereClause += ` AND t.date >= $${paramIdx++}`; params.push(start_date); }
  if (end_date) { whereClause += ` AND t.date <= $${paramIdx++}`; params.push(end_date); }
  if (due_date_start) { whereClause += ` AND t.due_date >= $${paramIdx++}`; params.push(due_date_start); }
  if (due_date_end) { whereClause += ` AND t.due_date <= $${paramIdx++}`; params.push(due_date_end); }
  if (homeIdsParam.length > 0) {
    const placeholders = homeIdsParam.map(() => `$${paramIdx++}`).join(",");
    whereClause += ` AND t.home_id IN (${placeholders})`;
    params.push(...homeIdsParam);
  }
  if (employee_id) { whereClause += ` AND t.employee_id = $${paramIdx++}`; params.push(employee_id); }
  if (company_id) { whereClause += ` AND t.company_id = $${paramIdx++}`; params.push(company_id); }
  if (categoryIdsParam.length > 0) {
    const placeholders = categoryIdsParam.map(() => `$${paramIdx++}`).join(",");
    whereClause += ` AND t.category_id IN (${placeholders})`;
    params.push(...categoryIdsParam);
  }
  if (type) { whereClause += ` AND t.type = $${paramIdx++}`; params.push(type); }
  if (status) { whereClause += ` AND t.status = $${paramIdx++}`; params.push(status); }

  const [totalsResult, evolutionResult, categoryResult] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(CASE WHEN type = 'REVENUE' AND status != 'CANCELED' THEN amount ELSE 0 END), 0) as receitas,
              COALESCE(SUM(CASE WHEN type = 'EXPENSE' AND status != 'CANCELED' THEN amount ELSE 0 END), 0) as despesas,
              COUNT(*) as lancamentos
       FROM transactions t ${whereClause}`,
      params
    ),
    pool.query(
      `SELECT to_char(date, 'YYYY-MM') as date,
              SUM(CASE WHEN type = 'REVENUE' AND status != 'CANCELED' THEN amount ELSE 0 END) as receitas,
              SUM(CASE WHEN type = 'EXPENSE' AND status != 'CANCELED' THEN amount ELSE 0 END) as despesas
       FROM transactions t ${whereClause}
       GROUP BY to_char(date, 'YYYY-MM')
       ORDER BY date ASC`,
      params
    ),
    pool.query(
      `SELECT c.name, SUM(t.amount) as value
       FROM transactions t JOIN categories c ON t.category_id = c.id
       ${whereClause} AND t.status != 'CANCELED'
       GROUP BY t.category_id, c.name ORDER BY value DESC LIMIT 10`,
      params
    ),
  ]);

  const totals = totalsResult.rows[0];
  return c.json({
    totals: {
      receitas: parseFloat(totals.receitas),
      despesas: parseFloat(totals.despesas),
      saldo: parseFloat(totals.receitas) - parseFloat(totals.despesas),
      lancamentos: parseInt(totals.lancamentos),
    },
    evolution: evolutionResult.rows,
    byCategory: categoryResult.rows,
  });
});

// ============ ATTACHMENTS ============

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, "..", "uploads");

app.post("/api/transactions/:id/attachments", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const transactionId = c.req.param("id");

  const { rows: txRows } = await pool.query("SELECT id FROM transactions WHERE id = $1 AND tenant_id = $2", [transactionId, tenantId]);
  if (!txRows[0]) return c.json({ error: "Transação não encontrada" }, 404);

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return c.json({ error: "Arquivo não enviado" }, 400);

  const originalName = file.name;
  const contentType = file.type || "application/octet-stream";
  const size = file.size;
  const filename = `transactions/${transactionId}/${Date.now()}-${originalName}`;

  const fullPath = path.join(UPLOADS_DIR, filename);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  const arrayBuffer = await file.arrayBuffer();
  fs.writeFileSync(fullPath, Buffer.from(arrayBuffer));

  const { rows } = await pool.query(
    `INSERT INTO attachments (transaction_id, filename, original_name, content_type, size) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [transactionId, filename, originalName, contentType, size]
  );

  return c.json({ id: rows[0].id, filename, original_name: originalName, content_type: contentType, size, success: true }, 201);
});

app.get("/api/transactions/:id/attachments", authMiddleware, async (c) => {
  const transactionId = c.req.param("id");
  const { rows } = await pool.query("SELECT * FROM attachments WHERE transaction_id = $1 ORDER BY created_at DESC", [transactionId]);
  return c.json(rows);
});

app.get("/api/attachments/:id/download", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const id = c.req.param("id");

  const { rows } = await pool.query(
    `SELECT a.* FROM attachments a JOIN transactions t ON a.transaction_id = t.id WHERE a.id = $1 AND t.tenant_id = $2`,
    [id, tenantId]
  );
  if (!rows[0]) return c.json({ error: "Anexo não encontrado" }, 404);

  const fullPath = path.join(UPLOADS_DIR, rows[0].filename);
  if (!fs.existsSync(fullPath)) return c.json({ error: "Arquivo não encontrado no storage" }, 404);

  const fileBuffer = fs.readFileSync(fullPath);
  return new Response(fileBuffer, {
    headers: {
      "Content-Type": rows[0].content_type,
      "Content-Disposition": `inline; filename="${rows[0].original_name}"`,
    },
  });
});

app.delete("/api/attachments/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const id = c.req.param("id");

  const { rows } = await pool.query(
    `SELECT a.filename FROM attachments a JOIN transactions t ON a.transaction_id = t.id WHERE a.id = $1 AND t.tenant_id = $2`,
    [id, tenantId]
  );
  if (!rows[0]) return c.json({ error: "Anexo não encontrado" }, 404);

  const fullPath = path.join(UPLOADS_DIR, rows[0].filename);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

  await pool.query("DELETE FROM attachments WHERE id = $1", [id]);
  return c.json({ success: true });
});

// ============ TIMESHEETS ============

app.get("/api/timesheets", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const { employee_id, month, year, status } = c.req.query();

  let sql = `SELECT t.*, e.name as employee_name, e.role as employee_role
             FROM timesheets t LEFT JOIN employees e ON t.employee_id = e.id
             WHERE t.tenant_id = $1`;
  const params: any[] = [tenantId];
  let paramIdx = 2;

  if (employee_id) { sql += ` AND t.employee_id = $${paramIdx++}`; params.push(employee_id); }
  if (month) { sql += ` AND t.month = $${paramIdx++}`; params.push(month); }
  if (year) { sql += ` AND t.year = $${paramIdx++}`; params.push(year); }
  if (status) { sql += ` AND t.status = $${paramIdx++}`; params.push(status); }

  sql += " ORDER BY t.year DESC, t.month DESC, e.name ASC";

  const { rows } = await pool.query(sql, params);
  return c.json(rows);
});

app.get("/api/timesheets/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const id = c.req.param("id");

  const { rows: tsRows } = await pool.query(
    `SELECT t.*, e.name as employee_name, e.role as employee_role, e.document,
            e.ctps_numero, e.ctps_serie, e.admission_date, e.work_schedule,
            e.saturday_schedule, e.weekly_rest, e.hours_per_day
     FROM timesheets t LEFT JOIN employees e ON t.employee_id = e.id
     WHERE t.id = $1 AND t.tenant_id = $2`,
    [id, tenantId]
  );
  if (!tsRows[0]) return c.json({ error: "Folha de ponto não encontrada" }, 404);

  const { rows: entries } = await pool.query(
    "SELECT * FROM timesheet_entries WHERE timesheet_id = $1 ORDER BY day ASC",
    [id]
  );
  return c.json({ ...tsRows[0], entries });
});

app.post("/api/timesheets", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const { employee_id, month, year } = await c.req.json();
  if (!employee_id || !month || !year) return c.json({ error: "Funcionário, mês e ano são obrigatórios" }, 400);

  const { rows: existing } = await pool.query(
    "SELECT id FROM timesheets WHERE employee_id = $1 AND month = $2 AND year = $3 AND tenant_id = $4",
    [employee_id, month, year, tenantId]
  );
  if (existing[0]) return c.json({ error: "Já existe uma folha de ponto para este funcionário neste mês" }, 400);

  const { rows } = await pool.query(
    `INSERT INTO timesheets (employee_id, month, year, tenant_id) VALUES ($1,$2,$3,$4) RETURNING id`,
    [employee_id, month, year, tenantId]
  );
  return c.json({ id: rows[0].id, success: true }, 201);
});

app.put("/api/timesheets/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const id = c.req.param("id");
  const { status, total_worked, total_expected, total_overtime, notes } = await c.req.json();
  const closed_at = status === "CLOSED" ? new Date().toISOString() : null;

  await pool.query(
    `UPDATE timesheets SET status=$1, total_worked=$2, total_expected=$3, total_overtime=$4, notes=$5, closed_at=$6, updated_at=NOW() WHERE id=$7 AND tenant_id=$8`,
    [status || "OPEN", total_worked || null, total_expected || null, total_overtime || null, notes || null, closed_at, id, tenantId]
  );
  return c.json({ success: true });
});

app.delete("/api/timesheets/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId") as number;
  const id = c.req.param("id");
  await pool.query("DELETE FROM timesheet_entries WHERE timesheet_id = $1", [id]);
  await pool.query("DELETE FROM timesheets WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  return c.json({ success: true });
});

// ============ TIMESHEET ENTRIES ============

app.post("/api/timesheets/:id/entries", authMiddleware, async (c) => {
  const timesheetId = c.req.param("id");
  const { day, entry1, exit1, entry2, exit2, hours_worked, hours_expected, overtime, observation } = await c.req.json();
  if (!day) return c.json({ error: "Dia é obrigatório" }, 400);

  const { rows: existing } = await pool.query(
    "SELECT id FROM timesheet_entries WHERE timesheet_id = $1 AND day = $2",
    [timesheetId, day]
  );

  if (existing[0]) {
    await pool.query(
      `UPDATE timesheet_entries SET entry1=$1, exit1=$2, entry2=$3, exit2=$4, hours_worked=$5, hours_expected=$6, overtime=$7, observation=$8, updated_at=NOW() WHERE id=$9`,
      [entry1 || null, exit1 || null, entry2 || null, exit2 || null, hours_worked || null, hours_expected || null, overtime || null, observation || null, existing[0].id]
    );
    return c.json({ id: existing[0].id, success: true });
  } else {
    const { rows } = await pool.query(
      `INSERT INTO timesheet_entries (timesheet_id, day, entry1, exit1, entry2, exit2, hours_worked, hours_expected, overtime, observation) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [timesheetId, day, entry1 || null, exit1 || null, entry2 || null, exit2 || null, hours_worked || null, hours_expected || null, overtime || null, observation || null]
    );
    return c.json({ id: rows[0].id, success: true }, 201);
  }
});

app.put("/api/timesheets/:id/entries", authMiddleware, async (c) => {
  const timesheetId = c.req.param("id");
  const { entries } = await c.req.json();
  if (!Array.isArray(entries)) return c.json({ error: "Entries deve ser um array" }, 400);

  await pool.query("DELETE FROM timesheet_entries WHERE timesheet_id = $1", [timesheetId]);

  for (const entry of entries) {
    if (entry.day) {
      await pool.query(
        `INSERT INTO timesheet_entries (timesheet_id, day, entry1, exit1, entry2, exit2, hours_worked, hours_expected, overtime, observation) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [timesheetId, entry.day, entry.entry1 || null, entry.exit1 || null, entry.entry2 || null, entry.exit2 || null, entry.hours_worked || null, entry.hours_expected || null, entry.overtime || null, entry.observation || null]
      );
    }
  }
  return c.json({ success: true });
});

// ============ STATIC FILES (production) ============

const publicDir = path.join(__dirname, "..", "public");
if (fs.existsSync(publicDir)) {
  app.use("/*", serveStatic({ root: "./dist/public" }));
  app.get("/*", (c) => {
    const indexHtml = fs.readFileSync(path.join(publicDir, "index.html"), "utf-8");
    return c.html(indexHtml);
  });
}

// ============ START SERVER ============

const port = parseInt(process.env.PORT || "3000");
console.log(`Server running on port ${port}`);
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" });
