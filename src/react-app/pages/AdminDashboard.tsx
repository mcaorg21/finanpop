import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Button } from "@/react-app/components/ui/button";
import { Badge } from "@/react-app/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/react-app/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/react-app/components/ui/dialog";
import { Label } from "@/react-app/components/ui/label";
import { Input } from "@/react-app/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/react-app/components/ui/select";
import { useToast } from "@/react-app/hooks/use-toast";
import { LogOut, Building2, Calendar, Edit, Plus, Users, Eye, EyeOff } from "lucide-react";

interface Tenant {
  id: number;
  name: string;
  company_type: string;
  cnpj: string | null;
  subscription_status: string;
  subscription_plan: string;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  is_active: number;
  created_at: string;
}

interface User {
  id: number;
  name: string;
  username: string;
  password: string;
  is_active: boolean;
  tenant_id: number;
  tenant_name: string;
  created_at: string;
}

const emptyUserForm = {
  name: "",
  username: "",
  password: "",
  tenant_id: "",
  is_active: true,
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"tenants" | "users">("tenants");

  // Tenants
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [editDialog, setEditDialog] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [formData, setFormData] = useState({
    subscription_status: "",
    subscription_plan: "",
    subscription_ends_at: "",
    is_active: 1,
  });

  // Users
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userDialog, setUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    checkAuth();
    fetchTenants();
  }, []);

  useEffect(() => {
    if (activeTab === "users" && users.length === 0) fetchUsers();
  }, [activeTab]);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/admin/me", { credentials: "include" });
      if (!res.ok) navigate("/admin");
    } catch {
      navigate("/admin");
    }
  };

  const fetchTenants = async () => {
    setLoadingTenants(true);
    try {
      const res = await fetch("/api/admin/tenants", { credentials: "include" });
      if (res.ok) setTenants(await res.json());
    } catch {
      toast({ title: "Erro ao carregar licenças", variant: "destructive" });
    } finally {
      setLoadingTenants(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (res.ok) setUsers(await res.json());
    } catch {
      toast({ title: "Erro ao carregar usuários", variant: "destructive" });
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    navigate("/admin");
  };

  // ---- Tenant edit ----
  const handleEdit = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setFormData({
      subscription_status: tenant.subscription_status,
      subscription_plan: tenant.subscription_plan,
      subscription_ends_at: tenant.subscription_ends_at ? tenant.subscription_ends_at.split("T")[0] : "",
      is_active: tenant.is_active,
    });
    setEditDialog(true);
  };

  const handleSave = async () => {
    if (!selectedTenant) return;
    try {
      let subscriptionEndsAt = null;
      if (formData.subscription_ends_at) {
        subscriptionEndsAt = new Date(formData.subscription_ends_at + "T23:59:59").toISOString();
      }
      const res = await fetch(`/api/admin/tenants/${selectedTenant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          subscription_status: formData.subscription_status,
          subscription_plan: formData.subscription_plan,
          subscription_ends_at: subscriptionEndsAt,
          is_active: formData.is_active,
        }),
      });
      if (res.ok) {
        toast({ title: "Licença atualizada com sucesso" });
        setEditDialog(false);
        fetchTenants();
      } else {
        const data = await res.json();
        toast({ title: "Erro ao atualizar", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    }
  };

  // ---- User create/edit ----
  const handleOpenNewUser = () => {
    setEditingUser(null);
    setUserForm(emptyUserForm);
    setShowPassword(false);
    setUserDialog(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setUserForm({
      name: user.name,
      username: user.username,
      password: "",
      tenant_id: user.tenant_id.toString(),
      is_active: user.is_active,
    });
    setShowPassword(false);
    setUserDialog(true);
  };

  const handleSaveUser = async () => {
    if (!userForm.name || !userForm.username || !userForm.tenant_id) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    if (!editingUser && !userForm.password) {
      toast({ title: "Senha é obrigatória para novo usuário", variant: "destructive" });
      return;
    }

    const url = editingUser ? `/api/admin/users/${editingUser.id}` : "/api/admin/users";
    const method = editingUser ? "PUT" : "POST";

    try {
      const body: Record<string, unknown> = {
        name: userForm.name,
        username: userForm.username,
        tenant_id: parseInt(userForm.tenant_id),
        is_active: userForm.is_active,
      };
      if (userForm.password) body.password = userForm.password;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        toast({ title: editingUser ? "Usuário atualizado" : "Usuário criado com sucesso" });
        setUserDialog(false);
        fetchUsers();
      } else {
        toast({ title: data.error || "Erro ao salvar", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      TRIAL: "secondary",
      ACTIVE: "default",
      EXPIRED: "destructive",
      CANCELLED: "outline",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("pt-BR");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Painel Administrativo</h1>
            <p className="text-slate-400">Gerenciamento de Licenças e Usuários</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tenants.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {tenants.filter((t) => t.subscription_status === "ACTIVE").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trial</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {tenants.filter((t) => t.subscription_status === "TRIAL").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expirados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {tenants.filter((t) => t.subscription_status === "EXPIRED").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-700">
          <button
            onClick={() => setActiveTab("tenants")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "tenants"
                ? "border-white text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Building2 className="w-4 h-4" />
            Licenças
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "users"
                ? "border-white text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users className="w-4 h-4" />
            Usuários
          </button>
        </div>

        {/* Tenants Tab */}
        {activeTab === "tenants" && (
          <Card>
            <CardHeader>
              <CardTitle>Licenças Cadastradas</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTenants ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead>Ativa</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenants.map((tenant) => (
                      <TableRow key={tenant.id}>
                        <TableCell className="font-medium">{tenant.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{tenant.company_type || "PJ"}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {tenant.cnpj
                            ? tenant.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
                            : "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(tenant.subscription_status)}</TableCell>
                        <TableCell className="uppercase">{tenant.subscription_plan}</TableCell>
                        <TableCell>{formatDate(tenant.subscription_ends_at)}</TableCell>
                        <TableCell>{formatDate(tenant.created_at)}</TableCell>
                        <TableCell>
                          <Badge variant={tenant.is_active ? "default" : "destructive"}>
                            {tenant.is_active ? "Sim" : "Não"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(tenant)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Usuários do Sistema</CardTitle>
              <Button size="sm" onClick={handleOpenNewUser} className="gap-2">
                <Plus className="w-4 h-4" />
                Novo Usuário
              </Button>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Login</TableHead>
                      <TableHead>Senha</TableHead>
                      <TableHead>Licença</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="text-muted-foreground">{user.id}</TableCell>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="font-mono text-sm">{user.username}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">{user.password}</TableCell>
                        <TableCell>
                          <span className="text-sm">{user.tenant_name || `#${user.tenant_id}`}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.is_active ? "default" : "destructive"}>
                            {user.is_active ? "Sim" : "Não"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(user.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleEditUser(user)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Tenant Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Licença: {selectedTenant?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Status da Assinatura</Label>
              <Select
                value={formData.subscription_status}
                onValueChange={(value) => setFormData({ ...formData, subscription_status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRIAL">Trial</SelectItem>
                  <SelectItem value="ACTIVE">Ativa</SelectItem>
                  <SelectItem value="EXPIRED">Expirada</SelectItem>
                  <SelectItem value="CANCELLED">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Plano</Label>
              <Select
                value={formData.subscription_plan}
                onValueChange={(value) => setFormData({ ...formData, subscription_plan: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE">Gratuito</SelectItem>
                  <SelectItem value="BASIC">Básico</SelectItem>
                  <SelectItem value="PRO">Pro</SelectItem>
                  <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subscription_ends_at" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Data de Vencimento
              </Label>
              <Input
                id="subscription_ends_at"
                type="date"
                value={formData.subscription_ends_at}
                onChange={(e) => setFormData({ ...formData, subscription_ends_at: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Conta Ativa</Label>
              <Select
                value={formData.is_active.toString()}
                onValueChange={(value) => setFormData({ ...formData, is_active: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Sim</SelectItem>
                  <SelectItem value="0">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit User Dialog */}
      <Dialog open={userDialog} onOpenChange={setUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? `Editar Usuário: ${editingUser.name}` : "Novo Usuário"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="u-name">Nome completo *</Label>
              <Input
                id="u-name"
                placeholder="Ex: João da Silva"
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-username">Login (username) *</Label>
              <Input
                id="u-username"
                placeholder="Ex: joao.silva ou joao@email.com"
                value={userForm.username}
                onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-password">
                Senha {editingUser ? "(deixe em branco para não alterar)" : "*"}
              </Label>
              <div className="relative">
                <Input
                  id="u-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
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
            <div className="space-y-2">
              <Label>Licença (Tenant) *</Label>
              <Select
                value={userForm.tenant_id}
                onValueChange={(v) => setUserForm({ ...userForm, tenant_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a licença" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id.toString()}>
                      #{t.id} — {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Usuário Ativo</Label>
              <Select
                value={userForm.is_active ? "true" : "false"}
                onValueChange={(v) => setUserForm({ ...userForm, is_active: v === "true" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Sim</SelectItem>
                  <SelectItem value="false">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveUser}>
              {editingUser ? "Salvar Alterações" : "Criar Usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
