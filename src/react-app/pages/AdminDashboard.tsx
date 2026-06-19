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
import { LogOut, Building2, Calendar, Edit } from "lucide-react";

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

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [formData, setFormData] = useState({
    subscription_status: "",
    subscription_plan: "",
    subscription_ends_at: "",
    is_active: 1,
  });

  useEffect(() => {
    checkAuth();
    fetchTenants();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/admin/me", { credentials: "include" });
      if (!res.ok) {
        navigate("/admin");
      }
    } catch {
      navigate("/admin");
    }
  };

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tenants", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setTenants(data);
      }
    } catch (error) {
      toast({
        title: "Erro ao carregar licenças",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    navigate("/admin");
  };

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
      // Convert date to ISO8601 format with time (YYYY-MM-DDTHH:mm:ss)
      let subscriptionEndsAt = null;
      if (formData.subscription_ends_at) {
        subscriptionEndsAt = new Date(formData.subscription_ends_at + 'T23:59:59').toISOString();
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
        toast({
          title: "Licença atualizada com sucesso",
        });
        setEditDialog(false);
        fetchTenants();
      } else {
        const data = await res.json();
        toast({
          title: "Erro ao atualizar",
          description: data.error,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Erro de conexão",
        variant: "destructive",
      });
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Painel Administrativo</h1>
            <p className="text-slate-400">Gerenciamento de Licenças e Assinaturas</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>

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

        <Card>
          <CardHeader>
            <CardTitle>Licenças Cadastradas</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
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
                        {tenant.cnpj ? tenant.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : "-"}
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
      </div>

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
    </div>
  );
}
