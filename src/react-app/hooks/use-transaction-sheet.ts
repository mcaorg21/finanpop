import { create } from "zustand";

// Estado global do painel de lançamento (abre de qualquer tela: sidebar, barra inferior, listas).
// `version` incrementa a cada save/delete — páginas que listam lançamentos refazem o fetch.

export interface TransactionRecord {
  id: number;
  date: string;
  type: "REVENUE" | "EXPENSE";
  amount: number;
  home_id: number;
  category_id: number;
  employee_id: number | null;
  company_id: number | null;
  payment_method: string;
  status: "PENDING" | "PAID" | "CANCELED";
  description: string | null;
  notes: string | null;
  due_date: string | null;
  payment_date: string | null;
  home_name?: string;
  category_name?: string;
  employee_name?: string | null;
  company_name?: string | null;
  attachment_count?: number | string;
  group_id?: string | null;
  group_index?: number | null;
  group_count?: number | null;
}

export interface TransactionDefaults {
  type?: "REVENUE" | "EXPENSE";
  home_id?: string;
  category_id?: string;
  date?: string;
  payment_method?: string;
  status?: "PENDING" | "PAID" | "CANCELED";
}

type SheetMode = "create" | "edit" | "duplicate";

interface TransactionSheetState {
  open: boolean;
  mode: SheetMode;
  transaction: TransactionRecord | null;
  defaults: TransactionDefaults | null;
  /** Abre com "Mais detalhes" expandido (ex.: ação "Anexos"). */
  expandDetails: boolean;
  version: number;
  openCreate: (defaults?: TransactionDefaults) => void;
  openEdit: (transaction: TransactionRecord, opts?: { expandDetails?: boolean }) => void;
  openDuplicate: (transaction: TransactionRecord) => void;
  close: () => void;
  notifySaved: () => void;
}

export const useTransactionSheet = create<TransactionSheetState>((set) => ({
  open: false,
  mode: "create",
  transaction: null,
  defaults: null,
  expandDetails: false,
  version: 0,

  openCreate: (defaults) =>
    set({ open: true, mode: "create", transaction: null, defaults: defaults ?? null, expandDetails: false }),

  openEdit: (transaction, opts) =>
    set({ open: true, mode: "edit", transaction, defaults: null, expandDetails: !!opts?.expandDetails }),

  openDuplicate: (transaction) =>
    set({ open: true, mode: "duplicate", transaction, defaults: null, expandDetails: false }),

  close: () => set({ open: false }),

  notifySaved: () => set((s) => ({ version: s.version + 1 })),
}));
