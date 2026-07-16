import { NavLink, useNavigate, useLocation } from "react-router";
import { Menu, X, ChevronDown } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { cn } from "@/react-app/lib/utils";
import { useState, useEffect } from "react";
import { Badge } from "@/react-app/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/react-app/components/ui/dropdown-menu";

const navItems = [
  { label: "Início", path: "/dashboard" },
  {
    label: "Cadastros",
    items: [
      { label: "Centro de Custo", path: "/cadastro/domicilios" },
      { label: "Categorias", path: "/cadastro/categorias" },
      { label: "Fornecedores", path: "/cadastro/empresas" },
      { label: "Funcionários", path: "/cadastro/funcionarios" },
    ],
  },
  {
    label: "Registros",
    items: [
      { label: "Receitas e Despesas", path: "/registro" },
      { label: "Folha de Ponto", path: "/folha-ponto" },
    ],
  },
  { label: "Relatórios", path: "/relatorios" },
];

const menuItems = [
  { label: "Configurações", path: "/configuracoes" },
  { label: "Ajuda", path: "/ajuda" },
];

interface SubscriptionInfo {
  subscription_status: string;
  subscription_plan: string;
  trial_ends_at: string | null;
}

export default function TopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  // Helper function to check if any dropdown item is active
  const isDropdownActive = (items: Array<{ path: string }>) => {
    return items.some(item => location.pathname === item.path);
  };

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const response = await fetch("/api/tenant/subscription");
        if (response.ok) {
          const data = await response.json();
          setSubscriptionInfo(data);

          // Calculate days remaining if on trial
          if (data.subscription_status === "TRIAL" && data.trial_ends_at) {
            const trialEnd = new Date(data.trial_ends_at);
            const now = new Date();

            // Set both dates to midnight to compare only dates, not times
            trialEnd.setHours(0, 0, 0, 0);
            now.setHours(0, 0, 0, 0);

            const diffTime = trialEnd.getTime() - now.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            setDaysRemaining(diffDays > 0 ? diffDays : 0);
          }
        }
      } catch (error) {
        console.error("Error fetching subscription:", error);
      }
    };

    fetchSubscription();
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    navigate("/");
  };

  return (
    <>
      {/* Top Navigation Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between px-4 lg:px-6 h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img
              src="/logo-secgo.png"
              alt="FinanPOP"
              className="w-8 h-8 object-contain"
            />
            <span className="font-semibold tracking-tight text-foreground hidden sm:block">FinanPOP</span>

            {/* Trial Badge */}
            {subscriptionInfo?.subscription_status === "TRIAL" && daysRemaining !== null && (
              <Badge
                variant={daysRemaining < 7 ? "destructive" : "secondary"}
                className={cn(
                  "ml-2 hidden md:flex cursor-pointer hover:opacity-80 transition-opacity"
                )}
                onClick={() => navigate("/configuracoes")}
              >
                {daysRemaining < 7
                  ? `Faltam ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'} - Reativar Assinatura`
                  : daysRemaining > 0
                    ? `${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'} restantes`
                    : 'Período de teste expirado'}
              </Badge>
            )}
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item, index) => {
              if ("items" in item) {
                const hasActiveChild = isDropdownActive(item.items || []);
                return (
                  <DropdownMenu key={index}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className={cn(
                          "flex items-center gap-1 px-3 py-2 text-sm rounded-md transition-colors",
                          hasActiveChild
                            ? "bg-muted text-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted font-normal"
                        )}
                      >
                        {item.label}
                        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      {item.items?.map((subItem) => (
                        <DropdownMenuItem key={subItem.path} asChild>
                          <NavLink
                            to={subItem.path}
                            className={({ isActive }) =>
                              cn(
                                "flex items-center px-2 py-2 cursor-pointer",
                                isActive && "bg-muted text-foreground font-medium"
                              )
                            }
                          >
                            {subItem.label}
                          </NavLink>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }

              if ("path" in item) {
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center px-3 py-2 rounded-md text-sm transition-colors",
                        isActive
                          ? "bg-muted text-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                );
              }

              return null;
            })}
          </nav>

          {/* Right Section - User Menu */}
          <div className="hidden lg:block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-1 text-sm text-muted-foreground hover:text-foreground font-normal">
                  Conta
                  <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {menuItems.map((item) => (
                  <DropdownMenuItem key={item.path} asChild>
                    <NavLink
                      to={item.path}
                      className="flex items-center px-2 py-2 cursor-pointer"
                    >
                      {item.label}
                    </NavLink>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem
                  className="flex items-center px-2 py-2 cursor-pointer text-destructive focus:text-destructive"
                  onClick={handleLogout}
                >
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="lg:hidden fixed top-16 left-0 right-0 z-50 bg-background border-b border-border shadow-md max-h-[calc(100vh-4rem)] overflow-y-auto">
          <nav className="p-4 space-y-2">
            {navItems.map((item, index) => {
              if ("items" in item) {
                return (
                  <div key={index} className="space-y-1">
                    <div className="px-3 pt-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {item.label}
                    </div>
                    <div className="space-y-1">
                      {item.items?.map((subItem) => (
                        <NavLink
                          key={subItem.path}
                          to={subItem.path}
                          onClick={() => setMobileOpen(false)}
                          className={({ isActive }) =>
                            cn(
                              "flex items-center px-3 py-2 rounded-md text-sm transition-colors",
                              isActive
                                ? "bg-muted text-foreground font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )
                          }
                        >
                          {subItem.label}
                        </NavLink>
                      ))}
                    </div>
                  </div>
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
                        "flex items-center px-3 py-2 rounded-md text-sm transition-colors",
                        isActive
                          ? "bg-muted text-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                );
              }

              return null;
            })}

            {/* Mobile Menu Items */}
            <div className="border-t border-border mt-4 pt-4 space-y-1">
              {menuItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center px-3 py-2 rounded-md text-sm transition-colors",
                      isActive
                        ? "bg-muted text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <Button
                variant="ghost"
                className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 font-normal"
                onClick={handleLogout}
              >
                Sair
              </Button>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
