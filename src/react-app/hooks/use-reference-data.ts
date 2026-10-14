import { create } from "zustand";

// Cadastros de apoio (centros de custo, categorias, funcionários, empresas) carregados
// uma vez e compartilhados por formulário de lançamento, listagens e relatórios.

export interface Home {
  id: number;
  name: string;
}

export interface Category {
  id: number;
  name: string;
  kind: "REVENUE" | "EXPENSE";
  parent_id: number | null;
}

export interface Employee {
  id: number;
  name: string;
  is_active: boolean;
}

export interface Company {
  id: number;
  name: string;
  is_active: boolean;
}

interface ReferenceState {
  homes: Home[];
  categories: Category[];
  employees: Employee[];
  companies: Company[];
  loaded: boolean;
  loading: boolean;
  load: (opts?: { force?: boolean }) => Promise<void>;
  refresh: () => Promise<void>;
  addCompany: (company: Company) => void;
}

const getJson = async <T,>(url: string): Promise<T[]> => {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) return [];
  return (await res.json()) as T[];
};

const normalizeActive = <T extends { is_active: unknown }>(rows: T[]): T[] =>
  rows.map((r) => ({ ...r, is_active: !!r.is_active }));

export const useReferenceData = create<ReferenceState>((set, get) => ({
  homes: [],
  categories: [],
  employees: [],
  companies: [],
  loaded: false,
  loading: false,

  load: async ({ force = false } = {}) => {
    const { loaded, loading } = get();
    if (loading || (loaded && !force)) return;
    set({ loading: true });
    try {
      const [homes, categories, employees, companies] = await Promise.all([
        getJson<Home>("/app/api/homes"),
        getJson<Category>("/app/api/categories"),
        getJson<Employee>("/app/api/employees"),
        getJson<Company>("/app/api/companies"),
      ]);
      set({
        homes,
        categories,
        employees: normalizeActive(employees),
        companies: normalizeActive(companies),
        loaded: true,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  refresh: () => get().load({ force: true }),

  addCompany: (company) =>
    set((s) => ({ companies: [...s.companies, { ...company, is_active: !!company.is_active }] })),
}));

export interface CategoryOption {
  id: number;
  name: string;
  parentName: string | null;
  /** "Pai → Filho" ou só o nome quando não há pai. */
  label: string;
}

/**
 * Categorias selecionáveis num lançamento: filhas + pais sem filhos, do tipo informado
 * (pais com filhos não podem ser escolhidos — mesma regra do formulário antigo).
 */
export function leafCategories(categories: Category[], kind: "REVENUE" | "EXPENSE"): CategoryOption[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const hasChildren = new Set(categories.filter((c) => c.parent_id != null).map((c) => c.parent_id as number));
  return categories
    .filter((c) => c.kind === kind && (c.parent_id != null || !hasChildren.has(c.id)))
    .map((c) => {
      const parent = c.parent_id != null ? byId.get(c.parent_id) : undefined;
      return {
        id: c.id,
        name: c.name,
        parentName: parent?.name ?? null,
        label: parent ? `${parent.name} → ${c.name}` : c.name,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}
