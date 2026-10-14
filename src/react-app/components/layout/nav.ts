import {
  BarChart3,
  Building,
  Building2,
  Clock,
  HelpCircle,
  Home,
  Receipt,
  Settings,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";

// Fonte única dos itens de navegação (sidebar, barra inferior e gaveta "Mais").

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

export const NAV_MAIN: NavItem[] = [
  { label: "Início", to: "/dashboard", icon: Home },
  { label: "Lançamentos", to: "/registro", icon: Receipt },
  { label: "Relatórios", to: "/relatorios", icon: BarChart3 },
];

export const NAV_CADASTROS: NavItem[] = [
  { label: "Centros de Custo", to: "/cadastro/domicilios", icon: Building2 },
  { label: "Categorias", to: "/cadastro/categorias", icon: Tag },
  { label: "Fornecedores", to: "/cadastro/empresas", icon: Building },
  { label: "Funcionários", to: "/cadastro/funcionarios", icon: Users },
];

export const NAV_EQUIPE: NavItem[] = [
  { label: "Folha de Ponto", to: "/folha-ponto", icon: Clock },
];

export const NAV_FOOTER: NavItem[] = [
  { label: "Configurações", to: "/configuracoes", icon: Settings },
  { label: "Ajuda", to: "/ajuda", icon: HelpCircle },
];

/** Rotas que a aba "Mais" (mobile) representa. */
export const NAV_MORE_ROUTES = [...NAV_CADASTROS, ...NAV_EQUIPE, ...NAV_FOOTER].map((i) => i.to);

export const isRouteActive = (pathname: string, to: string) =>
  pathname === to || pathname.startsWith(to + "/");

export const LOGO_SRC = `${import.meta.env.BASE_URL}logo-secgo.png`;
