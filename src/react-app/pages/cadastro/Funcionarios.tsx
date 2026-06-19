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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/react-app/components/ui/select";
import { Users, Plus, Pencil, Trash2, Search, Loader2, Star, Copy, Clock, Moon } from "lucide-react";
import { PixIcon } from "@/react-app/components/icons/PixIcon";
import { useToast } from "@/react-app/hooks/use-toast";
import { useAlert } from "@/react-app/hooks/use-alert";

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
  is_active: number;
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
  is_primary: number;
}

const defaultDaySchedule: DaySchedule = {
  is_rest: false,
  morning_start: "08:00",
  morning_end: "12:00",
  afternoon_start: "13:00",
  afternoon_end: "18:00",
};

const restDaySchedule: DaySchedule = {
  is_rest: true,
  morning_start: "",
  morning_end: "",
  afternoon_start: "",
  afternoon_end: "",
};

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
  monday: "Segunda-feira",
  tuesday: "Terça-feira",
  wednesday: "Quarta-feira",
  thursday: "Quinta-feira",
  friday: "Sexta-feira",
  saturday: "Sábado",
  sunday: "Domingo",
};

const emptyForm = {
  name: "",
  role: "",
  phone: "",
  document: "",
  notes: "",
  is_active: true,
  work_schedule: defaultWorkSchedule,
  ctps_numero: "",
  ctps_serie: "",
  admission_date: "",
  saturday_schedule: "",
  weekly_rest: "Domingo",
  hours_per_day: "8:48:00",
};

const emptyPixForm = {
  key_type: "CPF",
  key_value: "",
  is_primary: false,
};

// Masks
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  
  // Check for known invalid CPFs
  if (/^(\d)\1+$/.test(digits)) return false;
  
  // Validate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;
  
  // Validate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[10])) return false;
  
  return true;
}

const PIX_KEY_TYPES = [
  { value: "CPF", label: "CPF" },
  { value: "CNPJ", label: "CNPJ" },
  { value: "EMAIL", label: "E-mail" },
  { value: "PHONE", label: "Telefone" },
  { value: "RANDOM", label: "Chave Aleatória" },
];

export default function FuncionariosPage() {
  const { toast } = useToast();
  const { confirm } = useAlert();
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
  const [showWarningModal, setShowWarningModal] = useState(false);

  // PIX state
  const [selectedEmployee, setSelectedEmployee] = useState<Funcionario | null>(null);
  const [pixKeys, setPixKeys] = useState<PixKey[]>([]);
  const [pixForm, setPixForm] = useState(emptyPixForm);
  const [editingPixId, setEditingPixId] = useState<number | null>(null);
  const [isLoadingPix, setIsLoadingPix] = useState(false);
  const [isSavingPix, setIsSavingPix] = useState(false);

  const fetchFuncionarios = async () => {
    try {
      const res = await fetch("/api/employees", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setFuncionarios(data);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
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
    fetchFuncionarios();
    checkHomes();
  }, []);

  const handlePhoneChange = (value: string) => {
    setForm({ ...form, phone: formatPhone(value) });
  };

  const handleDocumentChange = (value: string) => {
    const formatted = formatCPF(value);
    setForm({ ...form, document: formatted });
    
    const digits = value.replace(/\D/g, "");
    if (digits.length === 11) {
      if (!validateCPF(digits)) {
        setCpfError("CPF inválido");
      } else {
        setCpfError("");
      }
    } else {
      setCpfError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate CPF if provided
    const cpfDigits = form.document.replace(/\D/g, "");
    if (cpfDigits.length > 0 && cpfDigits.length !== 11) {
      setCpfError("CPF deve ter 11 dígitos");
      return;
    }
    if (cpfDigits.length === 11 && !validateCPF(cpfDigits)) {
      setCpfError("CPF inválido");
      return;
    }

    setIsSaving(true);

    try {
      const url = editingId ? `/api/employees/${editingId}` : "/api/employees";
      const method = editingId ? "PUT" : "POST";

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
        method,
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
        toast({ title: editingId ? "Funcionário atualizado" : "Funcionário cadastrado" });
      }
    } catch (error) {
      console.error("Error saving employee:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (funcionario: Funcionario) => {
    let workSchedule = defaultWorkSchedule;
    if (funcionario.work_schedule) {
      try {
        workSchedule = JSON.parse(funcionario.work_schedule);
      } catch (e) {
        console.error("Error parsing work schedule:", e);
      }
    }
    setForm({
      name: funcionario.name || "",
      role: funcionario.role || "",
      phone: funcionario.phone || "",
      document: funcionario.document || "",
      notes: funcionario.notes || "",
      is_active: funcionario.is_active === 1,
      work_schedule: workSchedule,
      ctps_numero: funcionario.ctps_numero || "",
      ctps_serie: funcionario.ctps_serie || "",
      admission_date: funcionario.admission_date || "",
      saturday_schedule: funcionario.saturday_schedule || "",
      weekly_rest: funcionario.weekly_rest || "Domingo",
      hours_per_day: funcionario.hours_per_day || "8:48:00",
    });
    setEditingId(funcionario.id);
    setCpfError("");
    setIsOpen(true);
  };

  const updateDaySchedule = (day: keyof WorkSchedule, field: keyof DaySchedule, value: string | boolean) => {
    setForm({
      ...form,
      work_schedule: {
        ...form.work_schedule,
        [day]: {
          ...form.work_schedule[day],
          [field]: value,
        },
      },
    });
  };

  const toggleRestDay = (day: keyof WorkSchedule, isRest: boolean) => {
    if (isRest) {
      setForm({
        ...form,
        work_schedule: {
          ...form.work_schedule,
          [day]: { ...restDaySchedule },
        },
      });
    } else {
      setForm({
        ...form,
        work_schedule: {
          ...form.work_schedule,
          [day]: { ...defaultDaySchedule },
        },
      });
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: "Excluir funcionário?",
      message: "Esta ação não pode ser desfeita. Todas as chaves PIX deste funcionário também serão excluídas.",
      confirmText: "Excluir",
      cancelText: "Cancelar",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/employees/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        fetchFuncionarios();
        toast({ title: "Funcionário excluído" });
      }
    } catch (error) {
      console.error("Error deleting employee:", error);
    }
  };

  const handleOpenNew = () => {
    if (!hasHomes) {
      alert("É necessário cadastrar pelo menos 1 Centro de Custo antes de cadastrar funcionários.");
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    setCpfError("");
    setIsOpen(true);
  };

  // PIX functions
  const fetchPixKeys = async (employeeId: number) => {
    setIsLoadingPix(true);
    try {
      const res = await fetch(`/api/employees/${employeeId}/pix-keys`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setPixKeys(data);
      }
    } catch (error) {
      console.error("Error fetching PIX keys:", error);
    } finally {
      setIsLoadingPix(false);
    }
  };

  const handleOpenPix = (funcionario: Funcionario) => {
    setSelectedEmployee(funcionario);
    setPixForm(emptyPixForm);
    setEditingPixId(null);
    fetchPixKeys(funcionario.id);
    setIsPixOpen(true);
  };

  const handlePixSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    
    setIsSavingPix(true);
    try {
      const url = editingPixId 
        ? `/api/pix-keys/${editingPixId}`
        : `/api/employees/${selectedEmployee.id}/pix-keys`;
      const method = editingPixId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pixForm),
        credentials: "include",
      });

      if (res.ok) {
        setPixForm(emptyPixForm);
        setEditingPixId(null);
        fetchPixKeys(selectedEmployee.id);
        toast({ title: editingPixId ? "Chave PIX atualizada" : "Chave PIX cadastrada" });
      }
    } catch (error) {
      console.error("Error saving PIX key:", error);
    } finally {
      setIsSavingPix(false);
    }
  };

  const handleEditPix = (pix: PixKey) => {
    setPixForm({
      key_type: pix.key_type,
      key_value: pix.key_value,
      is_primary: pix.is_primary === 1,
    });
    setEditingPixId(pix.id);
  };

  const handleDeletePix = async (id: number) => {
    const ok = await confirm({
      title: "Excluir chave PIX?",
      message: "Esta ação não pode ser desfeita.",
      confirmText: "Excluir",
      cancelText: "Cancelar",
    });
    if (!ok || !selectedEmployee) return;

    try {
      const res = await fetch(`/api/pix-keys/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        fetchPixKeys(selectedEmployee.id);
        toast({ title: "Chave PIX excluída" });
      }
    } catch (error) {
      console.error("Error deleting PIX key:", error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Chave copiada!" });
  };

  const filtered = funcionarios.filter(
    (f) =>
      f.name?.toLowerCase().includes(search.toLowerCase()) ||
      f.role?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-7 h-7 text-primary" />
            Funcionários
          </h1>
          <p className="text-muted-foreground mt-1">
            Cadastre e gerencie os funcionários
          </p>
        </div>
        <Button onClick={handleOpenNew} className="gap-2" disabled={!hasHomes}>
          <Plus className="w-4 h-4" />
          Novo Funcionário
        </Button>
      </div>

      {/* Warning Modal */}
      <Dialog open={showWarningModal} onOpenChange={setShowWarningModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>⚠️ Centro de Custo Necessário</DialogTitle>
            <DialogDescription>
              É necessário cadastrar pelo menos 1 <strong>Centro de Custo</strong> antes de criar funcionários.
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

      {/* Employee Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Funcionário" : "Novo Funcionário"}</DialogTitle>
            <DialogDescription>
              Preencha os dados do funcionário
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                placeholder="Nome completo"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Cargo/Função</Label>
              <Input
                id="role"
                placeholder="Ex: Motorista, Cozinheira"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              />
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
                <Label htmlFor="document">CPF</Label>
                <Input
                  id="document"
                  placeholder="000.000.000-00"
                  value={form.document}
                  onChange={(e) => handleDocumentChange(e.target.value)}
                  className={cpfError ? "border-destructive" : ""}
                />
                {cpfError && <p className="text-xs text-destructive">{cpfError}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ctps_numero">CTPS Nº</Label>
                <Input
                  id="ctps_numero"
                  placeholder="Número da carteira"
                  value={form.ctps_numero}
                  onChange={(e) => setForm({ ...form, ctps_numero: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ctps_serie">Série</Label>
                <Input
                  id="ctps_serie"
                  placeholder="Série"
                  value={form.ctps_serie}
                  onChange={(e) => setForm({ ...form, ctps_serie: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="admission_date">Data de Admissão</Label>
                <Input
                  id="admission_date"
                  type="date"
                  value={form.admission_date}
                  onChange={(e) => setForm({ ...form, admission_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hours_per_day">Horas/Dia</Label>
                <Input
                  id="hours_per_day"
                  placeholder="8:48:00"
                  value={form.hours_per_day}
                  onChange={(e) => setForm({ ...form, hours_per_day: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="saturday_schedule">Horário Sábado</Label>
                <Input
                  id="saturday_schedule"
                  placeholder="Ex: 08:00-12:00"
                  value={form.saturday_schedule}
                  onChange={(e) => setForm({ ...form, saturday_schedule: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weekly_rest">Descanso Semanal</Label>
                <Input
                  id="weekly_rest"
                  placeholder="Ex: Domingo"
                  value={form.weekly_rest}
                  onChange={(e) => setForm({ ...form, weekly_rest: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Anotações sobre o funcionário"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            {/* Work Schedule Section */}
            <div className="space-y-3 pt-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Horário de Trabalho
              </Label>
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
                {(Object.keys(DAY_LABELS) as Array<keyof WorkSchedule>).map((day) => (
                  <div key={day} className="p-3 bg-muted/50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{DAY_LABELS[day]}</span>
                      <div className="flex items-center gap-2">
                        <Moon className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Descanso</span>
                        <Switch
                          checked={form.work_schedule[day].is_rest}
                          onCheckedChange={(checked) => toggleRestDay(day, checked)}
                        />
                      </div>
                    </div>
                    {!form.work_schedule[day].is_rest && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Manhã</span>
                          <div className="flex items-center gap-1">
                            <Input
                              type="time"
                              className="h-8 text-sm"
                              value={form.work_schedule[day].morning_start}
                              onChange={(e) => updateDaySchedule(day, "morning_start", e.target.value)}
                            />
                            <span className="text-xs text-muted-foreground">às</span>
                            <Input
                              type="time"
                              className="h-8 text-sm"
                              value={form.work_schedule[day].morning_end}
                              onChange={(e) => updateDaySchedule(day, "morning_end", e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Tarde</span>
                          <div className="flex items-center gap-1">
                            <Input
                              type="time"
                              className="h-8 text-sm"
                              value={form.work_schedule[day].afternoon_start}
                              onChange={(e) => updateDaySchedule(day, "afternoon_start", e.target.value)}
                            />
                            <span className="text-xs text-muted-foreground">às</span>
                            <Input
                              type="time"
                              className="h-8 text-sm"
                              value={form.work_schedule[day].afternoon_end}
                              onChange={(e) => updateDaySchedule(day, "afternoon_end", e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
              <Label htmlFor="active">Funcionário ativo</Label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving || !!cpfError}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* PIX Dialog */}
      <Dialog open={isPixOpen} onOpenChange={setIsPixOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PixIcon className="w-5 h-5 text-primary" />
              Chaves PIX
            </DialogTitle>
            <DialogDescription>
              {selectedEmployee?.name}
            </DialogDescription>
          </DialogHeader>

          {/* PIX Form */}
          <form onSubmit={handlePixSubmit} className="space-y-4 mt-4 p-4 bg-muted/50 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={pixForm.key_type}
                  onValueChange={(v) => setPixForm({ ...pixForm, key_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PIX_KEY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Chave</Label>
                <Input
                  placeholder="Valor da chave"
                  value={pixForm.key_value}
                  onChange={(e) => setPixForm({ ...pixForm, key_value: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="pix_primary"
                  checked={pixForm.is_primary}
                  onCheckedChange={(checked) => setPixForm({ ...pixForm, is_primary: checked })}
                />
                <Label htmlFor="pix_primary">Chave principal</Label>
              </div>
              <div className="flex gap-2">
                {editingPixId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPixForm(emptyPixForm);
                      setEditingPixId(null);
                    }}
                  >
                    Cancelar
                  </Button>
                )}
                <Button type="submit" size="sm" disabled={isSavingPix || !pixForm.key_value}>
                  {isSavingPix && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingPixId ? "Atualizar" : "Adicionar"}
                </Button>
              </div>
            </div>
          </form>

          {/* PIX Keys List */}
          <div className="space-y-2 mt-4">
            <h4 className="text-sm font-medium text-muted-foreground">Chaves cadastradas</h4>
            {isLoadingPix ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : pixKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma chave PIX cadastrada
              </p>
            ) : (
              <div className="space-y-2">
                {pixKeys.map((pix) => (
                  <div
                    key={pix.id}
                    className="flex items-center justify-between p-3 bg-background border rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {pix.is_primary === 1 && (
                        <Star className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">
                          {PIX_KEY_TYPES.find((t) => t.value === pix.key_type)?.label || pix.key_type}
                        </p>
                        <p className="text-sm font-mono truncate">{pix.key_value}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => copyToClipboard(pix.key_value)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEditPix(pix)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeletePix(pix.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou cargo..."
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
                      <TableHead>Cargo</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[140px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {funcionarios.length === 0
                            ? "Nenhum funcionário cadastrado. Clique em 'Novo Funcionário' para começar."
                            : "Nenhum funcionário encontrado com os filtros atuais."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="font-medium">{f.name}</TableCell>
                          <TableCell>{f.role || "-"}</TableCell>
                          <TableCell>{f.phone || "-"}</TableCell>
                          <TableCell className="font-mono text-sm">{f.document || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={f.is_active ? "default" : "secondary"}>
                              {f.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleOpenPix(f)}
                                title="Chaves PIX"
                              >
                                <PixIcon className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(f)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(f.id)}
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
                    {funcionarios.length === 0
                      ? "Nenhum funcionário cadastrado. Clique em 'Novo Funcionário' para começar."
                      : "Nenhum funcionário encontrado."}
                  </div>
                ) : (
                  filtered.map((f) => (
                    <div key={f.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{f.name}</p>
                            <Badge variant={f.is_active ? "default" : "secondary"} className="text-xs">
                              {f.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                          {f.role && <p className="text-sm text-muted-foreground">{f.role}</p>}
                          {f.phone && <p className="text-sm text-muted-foreground">{f.phone}</p>}
                          {f.document && <p className="text-sm text-muted-foreground font-mono">{f.document}</p>}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenPix(f)}
                          >
                            <PixIcon className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(f)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(f.id)}
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
