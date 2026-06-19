import { NavLink, useNavigate } from "react-router";
import {
  Home,
  Users,
  Building2,
  Building,
  Tag,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  FolderOpen,
  Clock,
  DollarSign,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { cn } from "@/react-app/lib/utils";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/react-app/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

const navItems = [
  { icon: Home, label: "Início", path: "/dashboard" },
  {
    icon: FolderOpen,
    label: "Cadastros",
    key: "cadastros",
    items: [
      { icon: Building2, label: "Centro de Custo", path: "/cadastro/domicilios" },
      { icon: Users, label: "Funcionários", path: "/cadastro/funcionarios" },
      { icon: Building, label: "Fornecedores", path: "/cadastro/empresas" },
      { icon: Tag, label: "Categorias", path: "/cadastro/categorias" },
    ],
  },
  {
    icon: Receipt,
    label: "Registros",
    key: "registros",
    items: [
      { icon: DollarSign, label: "Receitas e Despesas", path: "/registro" },
      { icon: Clock, label: "Folha de Ponto", path: "/folha-ponto" },
    ],
  },
  { icon: BarChart3, label: "Relatórios", path: "/relatorios" },
  { icon: Settings, label: "Configurações", path: "/configuracoes" },
  { icon: HelpCircle, label: "Ajuda", path: "/ajuda" },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    cadastros: true,
    registros: true,
  });

  const toggleMenu = (key: string) => {
    setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    navigate("/");
  };

  const NavContent = ({ showLogo = true }: { showLogo?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo - only show on desktop */}
      {showLogo && (
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <img
              src="/logo-secgo.png"
              alt="FinanPOP"
              className="w-10 h-10 object-contain"
            />
            <div>
              <h1 className="font-bold text-sidebar-foreground">FinanPOP</h1>
              <p className="text-xs text-muted-foreground">Hub Controle</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item, index) => {
          if ("items" in item && "key" in item) {
            const menuKey = item.key as string;
            const isOpen = openMenus[menuKey] ?? false;
            return (
              <Collapsible key={index} open={isOpen} onOpenChange={() => toggleMenu(menuKey)}>
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                      "text-sidebar-foreground hover:bg-sidebar-accent"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-4 space-y-1 mt-1">
                  {item.items!.map((subItem) => (
                    <NavLink
                      key={subItem.path}
                      to={subItem.path}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                          isActive
                            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                            : "text-sidebar-foreground hover:bg-sidebar-accent"
                        )
                      }
                    >
                      <subItem.icon className="w-4 h-4" />
                      {subItem.label}
                    </NavLink>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          }

          if ("path" in item) {
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  )
                }
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            );
          }

          return null;
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5" />
          Sair
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-sidebar-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo-secgo.png"
              alt="FinanPOP"
              className="w-8 h-8 object-contain"
            />
            <span className="font-bold text-sidebar-foreground">FinanPOP</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-6 h-6 text-white" /> : <Menu className="w-6 h-6 text-white" />}
          </Button>
        </div>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "lg:hidden fixed top-[65px] left-0 bottom-0 z-50 w-72 bg-sidebar border-r border-sidebar-border transform transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <NavContent showLogo={false} />
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed top-0 left-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border">
        <NavContent />
      </aside>
    </>
  );
}
