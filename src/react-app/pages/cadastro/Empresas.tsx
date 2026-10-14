import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Loader2, Pencil, Plus, Search, Store, Trash2, X } from "lucide-react";

import { Badge } from "@/react-app/components/ui/badge";
import { Button } from "@/react-app/components/ui/button";
import { EmptyState } from "@/react-app/components/ui/empty-state";
import { Input } from "@/react-app/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/react-app/components/ui/input-group";
import { Label } from "@/react-app/components/ui/label";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/react-app/components/ui/sheet";
import { Switch } from "@/react-app/components/ui/switch";
import { Textarea } from "@/react-app/components/ui/textarea";
import { PageHeader } from "@/react-app/components/app/PageHeader";
import { ResponsiveList, type Column } from "@/react-app/components/app/ResponsiveList";
import { RowActionsMenu } from "@/react-app/components/app/RowActionsMenu";
import { useAlert } from "@/react-app/hooks/use-alert";
import { useReferenceData } from "@/react-app/hooks/use-reference-data";
import { useToast } from "@/react-app/hooks/use-toast";
import { formatCNPJ, formatPhone, validateCNPJ } from "@/react-app/lib/format";

interface Empresa {
  id: number;
  name: string;
  cnpj: string;
  phone: string;
  email: string;
  notes: string;
  is_active: boolean | number;
}

// Mesmos campos do formulário antigo.
const emptyForm = { name: "", cnpj: "", phone: "", email: "", notes: "", is_active: true };

export default function EmpresasPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { confirm } = useAlert();
  const refreshReference = useReferenceData((s) => s.refresh);

  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [cnpjError, setCnpjError] = useState("");
  const [hasHomes, setHasHomes] = useState(true);

  const fetchEmpresas = async () => {
    try {
      const res = await fetch("/app/api/companies", { credentials: "include" });
      if (res.ok) setEmpresas(await res.json());
    } catch {
      toast({ title: "Erro ao carregar fornecedores", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmpresas();
    fetch("/app/api/homes", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: unknown[]) => setHasHomes(rows.length > 0))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requireHomes = async (): Promise<boolean> => {
    if (hasHomes) return true;
    const go = await confirm({
      title: "Centro de custo necessário",
      message: "Cadastre pelo menos um centro de custo antes de criar fornecedores. Ele organiza receitas e despesas por unidade, projeto ou conta.",
      confirmText: "Ir para centros de custo",
      cancelText: "Agora não",
    });
    if (go) navigate("/cadastro/domicilios");
    return false;
  };

  const handleCnpjChange = (value: string) => {
    const formatted = formatCNPJ(value);
    setForm((prev) => ({ ...prev, cnpj: formatted }));
    const digits = value.replace(/\D/g, "");
    setCnpjError(digits.length === 14 && !validateCNPJ(digits) ? "CNPJ inválido" : "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cnpjDigits = form.cnpj.replace(/\D/g, "");
    if (cnpjDigits.length > 0 && cnpjDigits.length !== 14) { setCnpjError("CNPJ deve ter 14 dígitos"); return; }
    if (cnpjDigits.length === 14 && !validateCNPJ(cnpjDigits)) { setCnpjError("CNPJ inválido"); return; }

    setIsSaving(true);
    try {
      const url = editingId ? `/app/api/companies/${editingId}` : "/app/api/companies";
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
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
        refreshReference();
        toast({ title: editingId ? "Fornecedor atualizado" : "Fornecedor cadastrado" });
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: "Erro ao salvar", description: data.error || "Verifique os dados e tente novamente", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro de conexão", description: "Não foi possível salvar o fornecedor", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (empresa: Empresa) => {
    setForm({
      name: empresa.name || "", cnpj: empresa.cnpj || "", phone: empresa.phone || "", email: empresa.email || "",
      notes: empresa.notes || "", is_active: !!empresa.is_active,
    });
    setEditingId(empresa.id);
    setCnpjError("");
    setIsOpen(true);
  };

  const handleDelete = async (empresa: Empresa) => {
    const ok = await confirm({
      title: "Excluir fornecedor?",
      message: `"${empresa.name}" será removido. Esta ação não pode ser desfeita.`,
      confirmText: "Excluir",
      cancelText: "Cancelar",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/app/api/companies/${empresa.id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        fetchEmpresas();
        refreshReference();
        toast({ title: "Fornecedor excluído" });
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: "Erro ao excluir", description: data.error || "Tente novamente", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    }
  };

  const handleOpenNew = async () => {
    if (!(await requireHomes())) return;
    setForm(emptyForm);
    setEditingId(null);
    setCnpjError("");
    setIsOpen(true);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return empresas;
    return empresas.filter((e) => e.name?.toLowerCase().includes(q) || e.cnpj?.includes(q));
  }, [empresas, search]);

  const statusBadge = (e: Empresa) => (
    <Badge variant={e.is_active ? "success" : "secondary"}>{e.is_active ? "Ativa" : "Inativa"}</Badge>
  );
  const actionsFor = (e: Empresa) => [
    { label: "Editar", icon: Pencil, onSelect: () => handleEdit(e) },
    { label: "Excluir", icon: Trash2, destructive: true, separatorBefore: true, onSelect: () => handleDelete(e) },
  ];

  const columns: Column<Empresa>[] = [
    { key: "name", header: "Nome", cell: (e) => <span className="font-medium">{e.name}</span> },
    { key: "cnpj", header: "CNPJ", cell: (e) => <span className="font-mono text-xs text-muted-foreground">{e.cnpj || "—"}</span> },
    { key: "phone", header: "Telefone", cell: (e) => <span className="text-muted-foreground">{e.phone || "—"}</span> },
    { key: "email", header: "E-mail", className: "max-w-[220px] truncate", cell: (e) => <span className="text-muted-foreground">{e.email || "—"}</span> },
    { key: "status", header: "Status", cell: statusBadge },
    { key: "actions", header: "", align: "right", className: "w-12", cell: (e) => <RowActionsMenu actions={actionsFor(e)} /> },
  ];

  const renderCard = (e: Empresa) => (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{e.name}</p>
          {statusBadge(e)}
        </div>
        {e.cnpj && <p className="font-mono text-xs text-muted-foreground">{e.cnpj}</p>}
        {(e.phone || e.email) && <p className="truncate text-sm text-muted-foreground">{[e.phone, e.email].filter(Boolean).join(" · ")}</p>}
      </div>
      <RowActionsMenu actions={actionsFor(e)} className="-mr-2" />
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fornecedores"
        description="Empresas e prestadores vinculados aos lançamentos"
        actions={
          <Button onClick={handleOpenNew}>
            <Plus /> Novo fornecedor
          </Button>
        }
        toolbar={
          <InputGroup className="w-full sm:w-80">
            <InputGroupAddon><Search /></InputGroupAddon>
            <InputGroupInput placeholder="Buscar por nome ou CNPJ..." value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && (
              <InputGroupAddon align="inline-end">
                <button type="button" aria-label="Limpar busca" onClick={() => setSearch("")}><X className="size-4" /></button>
              </InputGroupAddon>
            )}
          </InputGroup>
        }
      />

      <ResponsiveList
        rows={filtered}
        columns={columns}
        rowKey={(e) => e.id}
        renderCard={renderCard}
        breakpoint="md"
        isLoading={isLoading}
        onRowClick={handleEdit}
        rowClassName={(e) => (e.is_active ? undefined : "opacity-60")}
        emptyState={
          empresas.length === 0 ? (
            <EmptyState icon={Store} title="Nenhum fornecedor" description="Cadastre empresas e prestadores para vincular aos lançamentos." action={<Button size="sm" onClick={handleOpenNew}><Plus /> Novo fornecedor</Button>} />
          ) : (
            <EmptyState icon={Search} title="Nenhum resultado" description="Nenhum fornecedor corresponde à busca." />
          )
        }
      />

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent size="sm" mobileSide="full">
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <SheetHeader>
              <SheetTitle>{editingId ? "Editar fornecedor" : "Novo fornecedor"}</SheetTitle>
              <SheetDescription>Preencha os dados da empresa.</SheetDescription>
            </SheetHeader>
            <SheetBody className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome *</Label>
                <Input id="name" placeholder="Nome da empresa" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input id="cnpj" placeholder="00.000.000/0000-00" inputMode="numeric" value={form.cnpj} onChange={(e) => handleCnpjChange(e.target.value)} aria-invalid={!!cnpjError} />
                {cnpjError && <p className="text-xs text-destructive">{cnpjError}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" placeholder="(00) 00000-0000" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" placeholder="contato@empresa.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Observações</Label>
                <Textarea id="notes" placeholder="Anotações sobre a empresa" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <label className="flex cursor-pointer items-center gap-3">
                <Switch checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />
                <span className="text-sm">Fornecedor ativo</span>
              </label>
            </SheetBody>
            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving || !!cnpjError}>
                {isSaving && <Loader2 className="animate-spin" />} Salvar
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
