import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import { Settings, LogOut, Eye, EyeOff, User, Users, Plus, Pencil, Trash2, Loader2, CreditCard, Calendar, Building2, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/react-app/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/react-app/components/ui/table";
import { Badge } from "@/react-app/components/ui/badge";
import { Switch } from "@/react-app/components/ui/switch";
import { useAlert } from "@/react-app/hooks/use-alert";

interface AppUser {
  id: number;
  name: string;
  username: string;
  is_active: number;
  created_at: string;
  is_main_user?: boolean;
}

interface TenantSubscription {
  name: string;
  company_type: string;
  cnpj: string | null;
  subscription_status: string;
  subscription_plan: string;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
}

const emptyUser = {
  name: "",
  username: "",
  password: "",
  is_active: true,
};

export default function ConfiguracoesPage() {
  const navigate = useNavigate();
  const { error: showError, confirm } = useAlert();
  
  // User management state
  const [users, setUsers] = useState<AppUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [userForm, setUserForm] = useState(emptyUser);
  const [showPassword, setShowPassword] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [userMessage, setUserMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Current user info
  const [currentUser, setCurrentUser] = useState<{ name: string; username: string } | null>(null);

  // Subscription info
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [creatingPaymentLink, setCreatingPaymentLink] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchCurrentUser();
    fetchSubscription();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data);
      }
    } catch (error) {
      console.error("Error fetching current user:", error);
    }
  };

  const fetchSubscription = async () => {
    try {
      const res = await fetch("/api/tenant/subscription", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSubscription(data);
      }
    } catch (error) {
      console.error("Error fetching subscription:", error);
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    navigate("/");
  };

  const handleUpgradeSubscription = async () => {
    setCreatingPaymentLink(true);
    try {
      const res = await fetch("/api/tenant/create-payment-link", {
        method: "POST",
        credentials: "include",
      });
      
      if (res.ok) {
        const data = await res.json();
        // Open payment link in new window
        window.open(data.url, "_blank");
      } else {
        showError("Erro ao criar link de pagamento. Tente novamente.");
      }
    } catch (error) {
      console.error("Error creating payment link:", error);
      showError("Erro ao criar link de pagamento. Tente novamente.");
    } finally {
      setCreatingPaymentLink(false);
    }
  };

  const openNewUserDialog = () => {
    setEditingUser(null);
    setUserForm(emptyUser);
    setShowPassword(false);
    setUserMessage(null);
    setUserDialogOpen(true);
  };

  const openEditUserDialog = (user: AppUser) => {
    setEditingUser(user);
    setUserForm({
      name: user.name,
      username: user.username,
      password: "",
      is_active: user.is_active === 1,
    });
    setShowPassword(false);
    setUserMessage(null);
    setUserDialogOpen(true);
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserSaving(true);
    setUserMessage(null);

    try {
      const payload = {
        name: userForm.name,
        username: userForm.username,
        password: userForm.password || undefined,
        is_active: userForm.is_active,
      };

      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PUT" : "POST";

      // For new users, password is required
      if (!editingUser && !userForm.password) {
        setUserMessage({ type: "error", text: "Senha é obrigatória para novos usuários" });
        setUserSaving(false);
        return;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok) {
        setUserDialogOpen(false);
        fetchUsers();
      } else {
        setUserMessage({ type: "error", text: data.error || "Erro ao salvar usuário" });
      }
    } catch (error) {
      setUserMessage({ type: "error", text: "Erro ao salvar usuário" });
    } finally {
      setUserSaving(false);
    }
  };

  const handleDeleteUser = async (user: AppUser) => {
    const confirmed = await confirm({
      title: "Excluir usuário?",
      message: `Deseja realmente excluir "${user.name}"?`,
      confirmText: "Excluir",
      cancelText: "Cancelar",
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok) {
        fetchUsers();
      } else {
        showError(data.error || "Erro ao excluir usuário");
      }
    } catch (error) {
      showError("Erro ao excluir usuário");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-7 h-7" />
          Configurações
        </h1>
        <p className="text-muted-foreground mt-1">
          Gerencie sua conta e usuários do sistema
        </p>
      </div>

      {/* User Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="w-5 h-5" />
            Usuário Logado
          </CardTitle>
          <CardDescription>Informações da sua conta</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <User className="w-8 h-8 text-foreground" />
            </div>
            <div>
              <p className="font-semibold text-lg">{currentUser?.name || currentUser?.username || "..."}</p>
              <p className="text-sm text-muted-foreground">@{currentUser?.username}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Info */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Dados da Assinatura
              {subscription?.subscription_status === "EXPIRED" && (
                <Badge 
                  variant="destructive" 
                  className="animate-pulse ml-2"
                >
                  Assinatura vencida
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Informações sobre sua empresa e plano</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchSubscription}
            disabled={subscriptionLoading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${subscriptionLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {subscriptionLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : subscription ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Building2 className="w-4 h-4" />
                    <span>Empresa</span>
                  </div>
                  <p className="font-medium">{subscription.name}</p>
                  {subscription.cnpj && (
                    <p className="text-sm text-muted-foreground">
                      CNPJ: {subscription.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <CreditCard className="w-4 h-4" />
                    <span>Plano</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      subscription.subscription_plan === "PREMIUM" ? "default" :
                      subscription.subscription_plan === "PRO" ? "secondary" : "outline"
                    }>
                      {subscription.subscription_plan}
                    </Badge>
                    <Badge variant={
                      subscription.subscription_status === "ACTIVE" ? "default" :
                      subscription.subscription_status === "TRIAL" ? "secondary" : "destructive"
                    }>
                      {subscription.subscription_status === "ACTIVE" ? "Ativo" :
                       subscription.subscription_status === "TRIAL" ? "Período de Teste" :
                       subscription.subscription_status === "EXPIRED" ? "Expirado" : "Cancelado"}
                    </Badge>
                  </div>
                </div>
              </div>

              {(subscription.trial_ends_at || subscription.subscription_ends_at) && (
                <div className="pt-3 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Calendar className="w-4 h-4" />
                    <span>Validade</span>
                  </div>
                  <p className="font-medium">
                    {subscription.subscription_status === "TRIAL" && subscription.trial_ends_at ? (
                      `Teste válido até ${new Date(subscription.trial_ends_at).toLocaleDateString("pt-BR")}`
                    ) : subscription.subscription_ends_at ? (
                      `Assinatura válida até ${new Date(subscription.subscription_ends_at).toLocaleDateString("pt-BR")}`
                    ) : (
                      "Sem data de validade"
                    )}
                  </p>
                </div>
              )}

              {subscription.subscription_plan === "FREE" && (
                <div className="pt-3 border-t">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Assine o plano mensal</p>
                    <p className="text-sm text-muted-foreground">
                      Por apenas R$ 7,90/mês tenha acesso completo de controle financeiro do sistema
                    </p>
                    <Button 
                      onClick={handleUpgradeSubscription} 
                      disabled={creatingPaymentLink}
                      className="w-full gap-2"
                    >
                      {creatingPaymentLink ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Gerando link...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          Assinar Plano Mensal - R$ 7,90
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Não foi possível carregar as informações da assinatura</p>
          )}
        </CardContent>
      </Card>

      {/* User Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              Usuários do Sistema
            </CardTitle>
            <CardDescription>Gerencie os usuários que têm acesso ao sistema</CardDescription>
          </div>
          <Button onClick={openNewUserDialog} size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Usuário
          </Button>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Login</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {user.name}
                        {user.is_main_user && (
                          <Badge variant="outline" className="text-xs">Principal</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.username}</TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "default" : "secondary"}>
                        {user.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditUserDialog(user)}
                          className="h-8 w-8"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteUser(user)}
                          disabled={user.is_main_user}
                          className="h-8 w-8 text-destructive hover:text-destructive disabled:opacity-50 disabled:cursor-not-allowed"
                          title={user.is_main_user ? "Não é possível excluir o usuário principal" : "Excluir usuário"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhum usuário cadastrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Logout */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-destructive">
            <LogOut className="w-5 h-5" />
            Sair do Sistema
          </CardTitle>
          <CardDescription>Encerrar sua sessão atual</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleLogout} className="gap-2">
            <LogOut className="w-4 h-4" />
            Sair
          </Button>
        </CardContent>
      </Card>

      {/* User Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUserSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userName">Nome</Label>
              <Input
                id="userName"
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                placeholder="Nome completo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="userUsername">Login</Label>
              <Input
                id="userUsername"
                value={userForm.username}
                onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                placeholder="Nome de usuário para login"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="userPassword">
                Senha {editingUser && <span className="text-muted-foreground font-normal">(deixe em branco para manter)</span>}
              </Label>
              <div className="relative">
                <Input
                  id="userPassword"
                  type={showPassword ? "text" : "password"}
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder={editingUser ? "Nova senha (opcional)" : "Senha de acesso"}
                  required={!editingUser}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {editingUser && (
              <div className="flex items-center justify-between">
                <Label htmlFor="userActive">Usuário ativo</Label>
                <Switch
                  id="userActive"
                  checked={userForm.is_active}
                  onCheckedChange={(checked) => setUserForm({ ...userForm, is_active: checked })}
                />
              </div>
            )}

            {userMessage && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  userMessage.type === "success"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                }`}
              >
                {userMessage.text}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setUserDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={userSaving}>
                {userSaving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
