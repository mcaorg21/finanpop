import { useState, useEffect } from "react";
import { Card, CardContent } from "@/react-app/components/ui/card";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import { Textarea } from "@/react-app/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/react-app/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/react-app/components/ui/table";
import { Badge } from "@/react-app/components/ui/badge";
import { Switch } from "@/react-app/components/ui/switch";
import { Building, Plus, Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { useToast } from "@/react-app/hooks/use-toast";
import { useAlert } from "@/react-app/hooks/use-alert";

interface Empresa {
  id: number;
  name: string;
  cnpj: string;
  phone: string;
  email: string;
  notes: string;
  is_active: number;
}

const emptyForm = {
  name: "",
  cnpj: "",
  phone: "",
  email: "",
  notes: "",
  is_active: true,
};

// Masks
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  // First check digit
  let sum = 0;
  let weight = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i]) * weight[i];
  }
  let remainder = sum % 11;
  let checkDigit1 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(digits[12]) !== checkDigit1) return false;

  // Second check digit
  sum = 0;
  weight = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits[i]) * weight[i];
  }
  remainder = sum % 11;
  let checkDigit2 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(digits[13]) !== checkDigit2) return false;

  return true;
}

export default function EmpresasPage() {
  const { toast } = useToast();
  const { confirm } = useAlert();
  const { warning } = useAlert();
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [cnpjError, setCnpjError] = useState("");
  const [hasHomes, setHasHomes] = useState(true);
  const [showWarningModal, setShowWarningModal] = useState(false);

  const fetchEmpresas = async () => {
    try {
      const res = await fetch("/api/companies", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setEmpresas(data);
      }
    } catch (error) {
      console.error("Error fetching companies:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkHomes = async () => {
    try {
      const res = await fetch("/api/homes", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const hasHomesData = data.length > 0;
        setHasHomes(hasHomesData);
        if (!hasHomesData) {
          setShowWarningModal(true);
        }
      }
    } catch (error) {
      console.error("Error checking homes:", error);
    }
  };

  useEffect(() => {
    fetchEmpresas();
    checkHomes();
  }, []);

  const handlePhoneChange = (value: string) => {
    setForm({ ...form, phone: formatPhone(value) });
  };

  const handleCnpjChange = (value: string) => {
    const formatted = formatCNPJ(value);
    setForm({ ...form, cnpj: formatted });

    const digits = value.replace(/\D/g, "");
    if (digits.length === 14) {
      if (!validateCNPJ(digits)) {
        setCnpjError("CNPJ inválido");
      } else {
        setCnpjError("");
      }
    } else {
      setCnpjError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cnpjDigits = form.cnpj.replace(/\D/g, "");
    if (cnpjDigits.length > 0 && cnpjDigits.length !== 14) {
      setCnpjError("CNPJ deve ter 14 dígitos");
      return;
    }
    if (cnpjDigits.length === 14 && !validateCNPJ(cnpjDigits)) {
      setCnpjError("CNPJ inválido");
      return;
    }

    setIsSaving(true);

    try {
      const url = editingId ? `/api/companies/${editingId}` : "/api/companies";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
        credentials: "include",
      });

      if (res.ok) {
        setIsOpen(false);
        setForm(emptyForm);
        setEditingId(null);
        setCnpjError("");
        fetchEmpresas();
        toast({ title: editingId ? "Empresa atualizada" : "Empresa cadastrada" });
      }
    } catch (error) {
      console.error("Error saving company:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (empresa: Empresa) => {
    setForm({
      name: empresa.name || "",
      cnpj: empresa.cnpj || "",
      phone: empresa.phone || "",
      email: empresa.email || "",
      notes: empresa.notes || "",
      is_active: empresa.is_active === 1,
    });
    setEditingId(empresa.id);
    setCnpjError("");
    setIsOpen(true);
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: "Excluir empresa?",
      message: "Esta ação não pode ser desfeita.",
      confirmText: "Excluir",
      cancelText: "Cancelar",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/companies/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        fetchEmpresas();
        toast({ title: "Empresa excluída" });
      }
    } catch (error) {
      console.error("Error deleting company:", error);
    }
  };

  const handleOpenNew = () => {
    if (!hasHomes) {
      warning("É necessário cadastrar pelo menos 1 Centro de Custo antes de cadastrar fornecedores.");
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    setCnpjError("");
    setIsOpen(true);
  };

  const filtered = empresas.filter(
    (e) =>
      e.name?.toLowerCase().includes(search.toLowerCase()) ||
      e.cnpj?.includes(search)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building className="w-7 h-7 text-primary" />
            Empresas
          </h1>
          <p className="text-muted-foreground mt-1">
            Cadastre e gerencie as empresas
          </p>
        </div>
        <Button onClick={handleOpenNew} className="gap-2" disabled={!hasHomes}>
          <Plus className="w-4 h-4" />
          Nova Empresa
        </Button>
      </div>

      {/* Warning Modal */}
      <Dialog open={showWarningModal} onOpenChange={setShowWarningModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>⚠️ Centro de Custo Necessário</DialogTitle>
            <DialogDescription>
              É necessário cadastrar pelo menos 1 <strong>Centro de Custo</strong> antes de criar fornecedores.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O Centro de Custo é essencial para organizar seus registros financeiros. Ele serve para separar e acompanhar receitas e despesas por unidade ou setor.
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Exemplos:</strong> matriz, filiais, departamentos, projetos, obras, propriedades, estabelecimentos, contas pessoais entre outros.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowWarningModal(false)}>
                Entendi
              </Button>
              <Button onClick={() => window.location.href = "/cadastro/domicilios"}>
                Ir para Centro de Custo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
            <DialogDescription>
              Preencha os dados da empresa
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                placeholder="Nome da empresa"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                placeholder="00.000.000/0000-00"
                value={form.cnpj}
                onChange={(e) => handleCnpjChange(e.target.value)}
                className={cnpjError ? "border-destructive" : ""}
              />
              {cnpjError && <p className="text-xs text-destructive">{cnpjError}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  placeholder="(00) 00000-0000"
                  value={form.phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contato@empresa.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Anotações sobre a empresa"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
              <Label htmlFor="active">Empresa ativa</Label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving || !!cnpjError}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou CNPJ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {empresas.length === 0
                            ? "Nenhuma empresa cadastrada. Clique em 'Nova Empresa' para começar."
                            : "Nenhuma empresa encontrada com os filtros atuais."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{e.name}</TableCell>
                          <TableCell className="font-mono text-sm">{e.cnpj || "-"}</TableCell>
                          <TableCell>{e.phone || "-"}</TableCell>
                          <TableCell>{e.email || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={e.is_active ? "default" : "secondary"}>
                              {e.is_active ? "Ativa" : "Inativa"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(e)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(e.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y">
                {filtered.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground px-4">
                    {empresas.length === 0
                      ? "Nenhuma empresa cadastrada. Clique em 'Nova Empresa' para começar."
                      : "Nenhuma empresa encontrada."}
                  </div>
                ) : (
                  filtered.map((e) => (
                    <div key={e.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{e.name}</p>
                            <Badge variant={e.is_active ? "default" : "secondary"} className="text-xs">
                              {e.is_active ? "Ativa" : "Inativa"}
                            </Badge>
                          </div>
                          {e.cnpj && <p className="text-sm text-muted-foreground font-mono">{e.cnpj}</p>}
                          {e.phone && <p className="text-sm text-muted-foreground">{e.phone}</p>}
                          {e.email && <p className="text-sm text-muted-foreground">{e.email}</p>}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(e)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(e.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
