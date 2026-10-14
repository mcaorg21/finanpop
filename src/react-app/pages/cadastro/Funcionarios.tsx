import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Copy, KeyRound, Loader2, Pencil, Plus, Search, Trash2, Users, X } from "lucide-react";

import { Badge } from "@/react-app/components/ui/badge";
import { Button } from "@/react-app/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/react-app/components/ui/dialog";
import { EmptyState } from "@/react-app/components/ui/empty-state";
import { Input } from "@/react-app/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/react-app/components/ui/input-group";
import { Label } from "@/react-app/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/react-app/components/ui/select";
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
import { formatCPF, formatPhone, validateCPF } from "@/react-app/lib/format";

interface DaySchedule {
  is_rest: boolean;
  morning_start: string;
  morning_end: string;
  afternoon_start: string;
  afternoon_end: string;
}

interface WorkSchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

interface Funcionario {
  id: number;
  name: string;
  role: string;
  phone: string;
  document: string;
  notes: string;
  is_active: boolean | number;
  work_schedule: string | null;
  ctps_numero: string | null;
  ctps_serie: string | null;
  admission_date: string | null;
  saturday_schedule: string | null;
  weekly_rest: string | null;
  hours_per_day: string | null;
}

interface PixKey {
  id: number;
  employee_id: number;
  key_type: string;
  key_value: string;
  is_primary: boolean | number;
}

const defaultDaySchedule: DaySchedule = { is_rest: false, morning_start: "08:00", morning_end: "12:00", afternoon_start: "13:00", afternoon_end: "18:00" };
const restDaySchedule: DaySchedule = { is_rest: true, morning_start: "", morning_end: "", afternoon_start: "", afternoon_end: "" };

const defaultWorkSchedule: WorkSchedule = {
  monday: { ...defaultDaySchedule },
  tuesday: { ...defaultDaySchedule },
  wednesday: { ...defaultDaySchedule },
  thursday: { ...defaultDaySchedule },
  friday: { ...defaultDaySchedule },
  saturday: { ...restDaySchedule },
  sunday: { ...restDaySchedule },
};

const DAY_LABELS: Record<keyof WorkSchedule, string> = {
  monday: "Segunda-feira", tuesday: "Terça-feira", wednesday: "Quarta-feira", thursday: "Quinta-feira",
  friday: "Sexta-feira", saturday: "Sábado", sunday: "Domingo",
};

// Mesmos campos do formulário antigo.
const emptyForm = {
  name: "", role: "", phone: "", document: "", notes: "", is_active: true,
  work_schedule: defaultWorkSchedule,
  ctps_numero: "", ctps_serie: "", admission_date: "", saturday_schedule: "", weekly_rest: "Domingo", hours_per_day: "8:48:00",
};

const emptyPixForm = { key_type: "CPF", key_value: "", is_primary: false };

const PIX_KEY_TYPES = [
  { value: "CPF", label: "CPF" },
  { value: "CNPJ", label: "CNPJ" },
  { value: "EMAIL", label: "E-mail" },
  { value: "PHONE", label: "Telefone" },
  { value: "RANDOM", label: "Chave aleatória" },
];

export default function FuncionariosPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { confirm } = useAlert();
  const refreshReference = useReferenceData((s) => s.refresh);

  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isPixOpen, setIsPixOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [cpfError, setCpfError] = useState("");
  const [hasHomes, setHasHomes] = useState(true);

  // PIX
  const [selectedEmployee, setSelectedEmployee] = useState<Funcionario | null>(null);
  const [pixKeys, setPixKeys] = useState<PixKey[]>([]);
  const [pixForm, setPixForm] = useState(emptyPixForm);
  const [editingPixId, setEditingPixId] = useState<number | null>(null);
  const [isLoadingPix, setIsLoadingPix] = useState(false);
  const [isSavingPix, setIsSavingPix] = useState(false);

  const fetchFuncionarios = async () => {
    try {
      const res = await fetch("/app/api/employees", { credentials: "include" });
      if (res.ok) setFuncionarios(await res.json());
    } catch {
      toast({ title: "Erro ao carregar funcionários", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFuncionarios();
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
      message: "Cadastre pelo menos um centro de custo antes de criar funcionários. Ele organiza receitas e despesas por unidade, projeto ou conta.",
      confirmText: "Ir para centros de custo",
      cancelText: "Agora não",
    });
    if (go) navigate("/cadastro/domicilios");
    return false;
  };

  const handleDocumentChange = (value: string) => {
    const formatted = formatCPF(value);
    setForm((prev) => ({ ...prev, document: formatted }));
    const digits = value.replace(/\D/g, "");
    setCpfError(digits.length === 11 && !validateCPF(digits) ? "CPF inválido" : "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cpfDigits = form.document.replace(/\D/g, "");
    if (cpfDigits.length > 0 && cpfDigits.length !== 11) { setCpfError("CPF deve ter 11 dígitos"); return; }
    if (cpfDigits.length === 11 && !validateCPF(cpfDigits)) { setCpfError("CPF inválido"); return; }

    setIsSaving(true);
    try {
      const url = editingId ? `/app/api/employees/${editingId}` : "/app/api/employees";
      const payload = {
        ...form,
        work_schedule: JSON.stringify(form.work_schedule),
        ctps_numero: form.ctps_numero || null,
        ctps_serie: form.ctps_serie || null,
        admission_date: form.admission_date || null,
        saturday_schedule: form.saturday_schedule || null,
        weekly_rest: form.weekly_rest || null,
        hours_per_day: form.hours_per_day || null,
      };
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (res.ok) {
        setIsOpen(false);
        setForm(emptyForm);
        setEditingId(null);
        setCpfError("");
        fetchFuncionarios();
        refreshReference();
        toast({ title: editingId ? "Funcionário atualizado" : "Funcionário cadastrado" });
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: "Erro ao salvar", description: data.error || "Verifique os dados e tente novamente", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (f: Funcionario) => {
    let workSchedule = defaultWorkSchedule;
    if (f.work_schedule) {
      try { workSchedule = JSON.parse(f.work_schedule); } catch { /* mantém o padrão */ }
    }
    setForm({
      name: f.name || "", role: f.role || "", phone: f.phone || "", document: f.document || "", notes: f.notes || "",
      is_active: !!f.is_active,
      work_schedule: workSchedule,
      ctps_numero: f.ctps_numero || "", ctps_serie: f.ctps_serie || "", admission_date: f.admission_date || "",
      saturday_schedule: f.saturday_schedule || "", weekly_rest: f.weekly_rest || "Domingo", hours_per_day: f.hours_per_day || "8:48:00",
    });
    setEditingId(f.id);
    setCpfError("");
    setIsOpen(true);
  };

  const updateDaySchedule = (day: keyof WorkSchedule, field: keyof DaySchedule, value: string | boolean) =>
    setForm((prev) => ({ ...prev, work_schedule: { ...prev.work_schedule, [day]: { ...prev.work_schedule[day], [field]: value } } }));

  const toggleRestDay = (day: keyof WorkSchedule, isRest: boolean) =>
    setForm((prev) => ({ ...prev, work_schedule: { ...prev.work_schedule, [day]: isRest ? { ...restDaySchedule } : { ...defaultDaySchedule } } }));

  const handleDelete = async (f: Funcionario) => {
    const ok = await confirm({
      title: "Excluir funcionário?",
      message: `"${f.name}" e suas chaves PIX serão removidos. Esta ação não pode ser desfeita.`,
      confirmText: "Excluir",
      cancelText: "Cancelar",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/app/api/employees/${f.id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        fetchFuncionarios();
        refreshReference();
        toast({ title: "Funcionário excluído" });
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
    setCpfError("");
    setIsOpen(true);
  };

  // ── PIX ───────────────────────────────────────────────────────
  const fetchPixKeys = async (employeeId: number) => {
    setIsLoadingPix(true);
    try {
      const res = await fetch(`/app/api/employees/${employeeId}/pix-keys`, { credentials: "include" });
      if (res.ok) setPixKeys(await res.json());
    } finally {
      setIsLoadingPix(false);
    }
  };

  const handleOpenPix = (f: Funcionario) => {
    setSelectedEmployee(f);
    setPixForm(emptyPixForm);
    setEditingPixId(null);
    fetchPixKeys(f.id);
    setIsPixOpen(true);
  };

  const handlePixSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    setIsSavingPix(true);
    try {
      const url = editingPixId ? `/app/api/pix-keys/${editingPixId}` : `/app/api/employees/${selectedEmployee.id}/pix-keys`;
      const res = await fetch(url, {
        method: editingPixId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pixForm),
        credentials: "include",
      });
      if (res.ok) {
        setPixForm(emptyPixForm);
        setEditingPixId(null);
        fetchPixKeys(selectedEmployee.id);
        toast({ title: editingPixId ? "Chave PIX atualizada" : "Chave PIX cadastrada" });
      } else {
        toast({ title: "Erro ao salvar chave PIX", variant: "destructive" });
      }
    } finally {
      setIsSavingPix(false);
    }
  };

  const handleDeletePix = async (id: number) => {
    const ok = await confirm({ title: "Excluir chave PIX?", message: "Esta ação não pode ser desfeita.", confirmText: "Excluir", cancelText: "Cancelar", variant: "destructive" });
    if (!ok || !selectedEmployee) return;
    const res = await fetch(`/app/api/pix-keys/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) {
      fetchPixKeys(selectedEmployee.id);
      toast({ title: "Chave PIX excluída" });
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Chave copiada" });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  // ── Lista ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return funcionarios;
    return funcionarios.filter((f) => f.name?.toLowerCase().includes(q) || f.role?.toLowerCase().includes(q));
  }, [funcionarios, search]);

  const statusBadge = (f: Funcionario) => (
    <Badge variant={f.is_active ? "success" : "secondary"}>{f.is_active ? "Ativo" : "Inativo"}</Badge>
  );
  const actionsFor = (f: Funcionario) => [
    { label: "Chaves PIX", icon: KeyRound, onSelect: () => handleOpenPix(f) },
    { label: "Editar", icon: Pencil, onSelect: () => handleEdit(f) },
    { label: "Excluir", icon: Trash2, destructive: true, separatorBefore: true, onSelect: () => handleDelete(f) },
  ];

  const columns: Column<Funcionario>[] = [
    { key: "name", header: "Nome", cell: (f) => <span className="font-medium">{f.name}</span> },
    { key: "role", header: "Cargo", cell: (f) => <span className="text-muted-foreground">{f.role || "—"}</span> },
    { key: "phone", header: "Telefone", cell: (f) => <span className="text-muted-foreground">{f.phone || "—"}</span> },
    { key: "document", header: "CPF", cell: (f) => <span className="font-mono text-xs text-muted-foreground">{f.document || "—"}</span> },
    { key: "status", header: "Status", cell: statusBadge },
    { key: "actions", header: "", align: "right", className: "w-12", cell: (f) => <RowActionsMenu actions={actionsFor(f)} /> },
  ];

  const renderCard = (f: Funcionario) => (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{f.name}</p>
          {statusBadge(f)}
        </div>
        {f.role && <p className="text-sm text-muted-foreground">{f.role}</p>}
        {(f.phone || f.document) && <p className="truncate text-xs text-muted-foreground">{[f.phone, f.document].filter(Boolean).join(" · ")}</p>}
      </div>
      <RowActionsMenu actions={actionsFor(f)} className="-mr-2" />
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Funcionários"
        description="Pessoas que trabalham nos centros de custo"
        actions={
          <Button onClick={handleOpenNew}>
            <Plus /> Novo funcionário
          </Button>
        }
        toolbar={
          <InputGroup className="w-full sm:w-80">
            <InputGroupAddon><Search /></InputGroupAddon>
            <InputGroupInput placeholder="Buscar por nome ou cargo..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
        rowKey={(f) => f.id}
        renderCard={renderCard}
        breakpoint="md"
        isLoading={isLoading}
        onRowClick={handleEdit}
        rowClassName={(f) => (f.is_active ? undefined : "opacity-60")}
        emptyState={
          funcionarios.length === 0 ? (
            <EmptyState icon={Users} title="Nenhum funcionário" description="Cadastre quem trabalha nos seus centros de custo." action={<Button size="sm" onClick={handleOpenNew}><Plus /> Novo funcionário</Button>} />
          ) : (
            <EmptyState icon={Search} title="Nenhum resultado" description="Nenhum funcionário corresponde à busca." />
          )
        }
      />

      {/* Formulário */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent size="lg" mobileSide="full">
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <SheetHeader>
              <SheetTitle>{editingId ? "Editar funcionário" : "Novo funcionário"}</SheetTitle>
              <SheetDescription>Dados pessoais, contrato e horário de trabalho.</SheetDescription>
            </SheetHeader>
            <SheetBody className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input id="name" placeholder="Nome completo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="role">Cargo/Função</Label>
                  <Input id="role" placeholder="Ex: Motorista, Cozinheira" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" placeholder="(00) 00000-0000" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="document">CPF</Label>
                  <Input id="document" placeholder="000.000.000-00" inputMode="numeric" value={form.document} onChange={(e) => handleDocumentChange(e.target.value)} aria-invalid={!!cpfError} />
                  {cpfError && <p className="text-xs text-destructive">{cpfError}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ctps_numero">CTPS nº</Label>
                  <Input id="ctps_numero" placeholder="Número da carteira" value={form.ctps_numero} onChange={(e) => setForm({ ...form, ctps_numero: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ctps_serie">Série</Label>
                  <Input id="ctps_serie" placeholder="Série" value={form.ctps_serie} onChange={(e) => setForm({ ...form, ctps_serie: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admission_date">Data de admissão</Label>
                  <Input id="admission_date" type="date" value={form.admission_date} onChange={(e) => setForm({ ...form, admission_date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hours_per_day">Horas/dia</Label>
                  <Input id="hours_per_day" placeholder="8:48:00" value={form.hours_per_day} onChange={(e) => setForm({ ...form, hours_per_day: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="saturday_schedule">Horário de sábado</Label>
                  <Input id="saturday_schedule" placeholder="Ex: 08:00-12:00" value={form.saturday_schedule} onChange={(e) => setForm({ ...form, saturday_schedule: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="weekly_rest">Descanso semanal</Label>
                  <Input id="weekly_rest" placeholder="Ex: Domingo" value={form.weekly_rest} onChange={(e) => setForm({ ...form, weekly_rest: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea id="notes" placeholder="Anotações sobre o funcionário" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Horário de trabalho</Label>
                <div className="space-y-2">
                  {(Object.keys(DAY_LABELS) as Array<keyof WorkSchedule>).map((day) => {
                    const d = form.work_schedule[day];
                    return (
                      <div key={day} className="space-y-2 rounded-lg bg-muted/50 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{DAY_LABELS[day]}</span>
                          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                            Descanso
                            <Switch size="sm" checked={d.is_rest} onCheckedChange={(checked) => toggleRestDay(day, checked)} />
                          </label>
                        </div>
                        {!d.is_rest && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <span className="text-xs text-muted-foreground">Manhã</span>
                              <div className="flex items-center gap-1">
                                <Input type="time" className="h-9 text-sm md:h-8" value={d.morning_start} onChange={(e) => updateDaySchedule(day, "morning_start", e.target.value)} />
                                <span className="text-xs text-muted-foreground">às</span>
                                <Input type="time" className="h-9 text-sm md:h-8" value={d.morning_end} onChange={(e) => updateDaySchedule(day, "morning_end", e.target.value)} />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-xs text-muted-foreground">Tarde</span>
                              <div className="flex items-center gap-1">
                                <Input type="time" className="h-9 text-sm md:h-8" value={d.afternoon_start} onChange={(e) => updateDaySchedule(day, "afternoon_start", e.target.value)} />
                                <span className="text-xs text-muted-foreground">às</span>
                                <Input type="time" className="h-9 text-sm md:h-8" value={d.afternoon_end} onChange={(e) => updateDaySchedule(day, "afternoon_end", e.target.value)} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-3">
                <Switch checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />
                <span className="text-sm">Funcionário ativo</span>
              </label>
            </SheetBody>
            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving || !!cpfError}>
                {isSaving && <Loader2 className="animate-spin" />} Salvar
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Chaves PIX (diálogo, como antes) */}
      <Dialog open={isPixOpen} onOpenChange={setIsPixOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Chaves PIX</DialogTitle>
            <DialogDescription>{selectedEmployee?.name}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePixSubmit} className="space-y-3 rounded-lg bg-muted/50 p-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={pixForm.key_type} onValueChange={(v) => setPixForm({ ...pixForm, key_type: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PIX_KEY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Chave</Label>
                <Input placeholder="Valor da chave" value={pixForm.key_value} onChange={(e) => setPixForm({ ...pixForm, key_value: e.target.value })} required />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Switch checked={pixForm.is_primary} onCheckedChange={(checked) => setPixForm({ ...pixForm, is_primary: checked })} />
                Chave principal
              </label>
              <div className="flex gap-2">
                {editingPixId && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setPixForm(emptyPixForm); setEditingPixId(null); }}>Cancelar</Button>
                )}
                <Button type="submit" size="sm" disabled={isSavingPix || !pixForm.key_value}>
                  {isSavingPix && <Loader2 className="animate-spin" />} {editingPixId ? "Atualizar" : "Adicionar"}
                </Button>
              </div>
            </div>
          </form>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Chaves cadastradas</h4>
            {isLoadingPix ? (
              <div className="flex justify-center py-4"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
            ) : pixKeys.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma chave PIX cadastrada</p>
            ) : (
              <div className="space-y-2">
                {pixKeys.map((pix) => (
                  <div key={pix.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background p-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {PIX_KEY_TYPES.find((t) => t.value === pix.key_type)?.label || pix.key_type}
                        {!!pix.is_primary && <span className="ml-1.5 font-medium text-foreground">· Principal</span>}
                      </p>
                      <p className="truncate font-mono text-sm">{pix.key_value}</p>
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Copiar chave" title="Copiar" onClick={() => copyToClipboard(pix.key_value)}><Copy /></Button>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar chave" title="Editar" onClick={() => { setPixForm({ key_type: pix.key_type, key_value: pix.key_value, is_primary: !!pix.is_primary }); setEditingPixId(pix.id); }}><Pencil /></Button>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Excluir chave" title="Excluir" className="text-destructive hover:text-destructive" onClick={() => handleDeletePix(pix.id)}><Trash2 /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
