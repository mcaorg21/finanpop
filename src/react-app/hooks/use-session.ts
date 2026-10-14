import { create } from "zustand";

// Sessão carregada UMA vez por visita (antes: /auth/me + /tenant/subscription a cada rota,
// e de novo no TopNav). Páginas leem daqui; AppShell chama load() na montagem.

export interface SessionUser {
  id: number;
  name: string;
  username: string;
  tenant_id: number;
}

export interface TenantSubscription {
  name?: string;
  company_type?: string;
  cnpj?: string | null;
  subscription_status: string;
  subscription_plan?: string;
  trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
  [key: string]: unknown;
}

type SessionStatus = "idle" | "loading" | "ready" | "unauthenticated";

interface SessionState {
  user: SessionUser | null;
  subscription: TenantSubscription | null;
  status: SessionStatus;
  lastLoadedAt: number;
  load: () => Promise<void>;
  /** Refaz as duas chamadas sem mostrar loading (ex.: depois de pagar, ao voltar para a aba). */
  refresh: (opts?: { force?: boolean }) => Promise<void>;
  logout: () => Promise<void>;
  clear: () => void;
}

const REFRESH_THROTTLE_MS = 60_000;

async function fetchSession(): Promise<{ user: SessionUser | null; subscription: TenantSubscription | null; authenticated: boolean }> {
  const [meRes, subRes] = await Promise.all([
    fetch("/app/api/auth/me", { credentials: "include" }),
    fetch("/app/api/tenant/subscription", { credentials: "include" }),
  ]);
  if (!meRes.ok) return { user: null, subscription: null, authenticated: false };
  const user = (await meRes.json()) as SessionUser;
  const subscription = subRes.ok ? ((await subRes.json()) as TenantSubscription) : null;
  return { user, subscription, authenticated: true };
}

export const useSession = create<SessionState>((set, get) => ({
  user: null,
  subscription: null,
  status: "idle",
  lastLoadedAt: 0,

  load: async () => {
    if (get().status === "loading") return;
    set({ status: "loading" });
    try {
      const { user, subscription, authenticated } = await fetchSession();
      set({
        user,
        subscription,
        status: authenticated ? "ready" : "unauthenticated",
        lastLoadedAt: Date.now(),
      });
    } catch {
      set({ user: null, subscription: null, status: "unauthenticated" });
    }
  },

  refresh: async ({ force = false } = {}) => {
    const { status, lastLoadedAt } = get();
    if (status !== "ready") return;
    if (!force && Date.now() - lastLoadedAt < REFRESH_THROTTLE_MS) return;
    try {
      const { user, subscription, authenticated } = await fetchSession();
      if (!authenticated) {
        set({ user: null, subscription: null, status: "unauthenticated" });
        return;
      }
      set({ user, subscription, lastLoadedAt: Date.now() });
    } catch {
      // mantém o estado anterior; a próxima navegação tenta de novo
    }
  },

  logout: async () => {
    try {
      await fetch("/app/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      set({ user: null, subscription: null, status: "unauthenticated", lastLoadedAt: 0 });
    }
  },

  clear: () => set({ user: null, subscription: null, status: "idle", lastLoadedAt: 0 }),
}));

/** Mesma regra do DashboardLayout antigo (bloqueio de navegação). */
export const selectIsExpired = (s: Pick<SessionState, "subscription">): boolean => {
  const sub = s.subscription;
  if (!sub) return false;
  const now = new Date();
  if (sub.subscription_status === "TRIAL" && sub.trial_ends_at) {
    return now > new Date(sub.trial_ends_at);
  }
  if (sub.subscription_status === "EXPIRED") return true;
  if (sub.subscription_ends_at) return now > new Date(sub.subscription_ends_at);
  return false;
};

/** Dias restantes do trial (normalizado à meia-noite, como no TopNav antigo); null fora do trial. */
export const selectTrialDaysRemaining = (s: Pick<SessionState, "subscription">): number | null => {
  const sub = s.subscription;
  if (!sub || sub.subscription_status !== "TRIAL" || !sub.trial_ends_at) return null;
  const trialEnd = new Date(sub.trial_ends_at);
  const now = new Date();
  trialEnd.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

export const trialBadgeText = (days: number): string => {
  if (days <= 0) return "Período de teste expirado";
  const unit = days === 1 ? "dia" : "dias";
  return days < 7 ? `Faltam ${days} ${unit} - Reativar Assinatura` : `${days} ${unit} restantes`;
};
