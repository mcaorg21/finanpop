import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Plus } from "lucide-react";

import { cn } from "@/react-app/lib/utils";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import { Textarea } from "@/react-app/components/ui/textarea";
import { Switch } from "@/react-app/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/react-app/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/react-app/components/ui/toggle-group";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/react-app/components/ui/input-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/react-app/components/ui/collapsible";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/react-app/components/ui/sheet";
import { useToast } from "@/react-app/hooks/use-toast";
import { useReferenceData } from "@/react-app/hooks/use-reference-data";
import { useSession, selectIsExpired } from "@/react-app/hooks/use-session";
import { useTransactionSheet } from "@/react-app/hooks/use-transaction-sheet";
import { addDays, formatCurrency, formatInputCurrency, parseCurrencyToNumber, splitCents, todayISO } from "@/react-app/lib/format";
import { PAYMENT_METHODS } from "@/react-app/lib/labels";
import { CategoryCombobox } from "./CategoryCombobox";
import { AttachmentsField, type Attachment } from "./AttachmentsField";
import { LAST_HOME_KEY, clamp, emptyForm, fromRecord, toPayload, validateForm, type TransactionFormValues } from "./types";

const NONE = "__none";

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

interface ApiResponse {
  error?: string;
  id?: number;
  ids?: number[];
  total?: number;
  [key: string]: unknown;
}

async function request(url: string, init: RequestInit) {
  const res = await fetch(url, { credentials: "include", ...init });
  let data: ApiResponse | null = null;
  try { data = (await res.json()) as ApiResponse; } catch { /* sem corpo */ }
  return { ok: res.ok, data };
}

export default function TransactionSheet() {
  const open = useTransactionSheet((s) => s.open);
  const mode = useTransactionSheet((s) => s.mode);
  const transaction = useTransactionSheet((s) => s.transaction);
  const defaults = useTransactionSheet((s) => s.defaults);
  const expandDetails = useTransactionSheet((s) => s.expandDetails);
  const close = useTransactionSheet((s) => s.close);
  const notifySaved = useTransactionSheet((s) => s.notifySaved);

  const { toast } = useToast();
  const isExpired = useSession(selectIsExpired);
  const homes = useReferenceData((s) => s.homes);
  const employees = useReferenceData((s) => s.employees);
  const companies = useReferenceData((s) => s.companies);
  const loadReference = useReferenceData((s) => s.load);
  const addCompany = useReferenceData((s) => s.addCompany);

  const [form, setForm] = useState<TransactionFormValues>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cardType, setCardType] = useState<"" | "credit" | "debit">("");
  const [installments, setInstallments] = useState("2");
  const [enableRepeat, setEnableRepeat] = useState(false);
  const [repeatMonths, setRepeatMonths] = useState("2");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [quickCompany, setQuickCompany] = useState("");
  const [showQuickCompany, setShowQuickCompany] = useState(false);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const isEdit = mode === "edit";
  const editingId = isEdit && transaction ? transaction.id : null;

  const resetExtras = () => {
    setErrors({});
    setPendingFiles([]);
    setExistingAttachments([]);
    setCardType("");
    setInstallments("2");
    setEnableRepeat(false);
    setRepeatMonths("2");
    setQuickCompany("");
    setShowQuickCompany(false);
  };

  // Inicializa o formulário a cada abertura, conforme o modo.
  useEffect(() => {
    if (!open) return;
    if (isExpired) {
      close();
      toast({ title: "Reative sua assinatura para registrar lançamentos", variant: "destructive" });
      return;
    }
    loadReference();
    resetExtras();
    if (mode === "create") {
      const lastHome = localStorage.getItem(LAST_HOME_KEY) || "";
      setForm({ ...emptyForm(), home_id: lastHome, ...(defaults ?? {}) });
      setDetailsOpen(!!expandDetails);
    } else if (transaction) {
      setForm(fromRecord(transaction, { duplicate: mode === "duplicate" }));
      setDetailsOpen(mode === "edit" || !!expandDetails);
      if (mode === "edit") {
        fetch(`/app/api/transactions/${transaction.id}/attachments`, { credentials: "include" })
          .then((r) => (r.ok ? r.json() : []))
          .then((data) => setExistingAttachments(data))
          .catch(() => {});
      }
    }
    const t = setTimeout(() => amountRef.current?.focus(), 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Centro de custo: valida o lembrado e auto-seleciona quando só existe um.
  useEffect(() => {
    if (!open || mode !== "create" || homes.length === 0) return;
    setForm((f) => {
      if (f.home_id && homes.some((h) => String(h.id) === f.home_id)) return f;
      if (homes.length === 1) return { ...f, home_id: String(homes[0].id) };
      return f.home_id ? { ...f, home_id: "" } : f;
    });
  }, [homes, open, mode]);

  const set = <K extends keyof TransactionFormValues>(key: K, value: TransactionFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setStatus = (status: TransactionFormValues["status"]) =>
    setForm((f) => ({
      ...f,
      status,
      payment_date: status === "PAID" ? f.payment_date || todayISO() : "",
    }));

  const total = parseCurrencyToNumber(form.amount);
  const isCardCredit = form.payment_method === "CARD" && cardType === "credit";
  const installmentCount = isCardCredit && !editingId ? clamp(parseInt(installments) || 1, 1, 48) : 1;
  const installmentParts = installmentCount > 1 ? splitCents(total, installmentCount) : [];
  const canRepeat = !editingId && !(isCardCredit && installmentCount > 1);

  const uploadFiles = async (transactionId: number) => {
    for (const file of pendingFiles) {
      const fd = new FormData();
      fd.append("file", file);
      await fetch(`/app/api/transactions/${transactionId}/attachments`, { method: "POST", body: fd, credentials: "include" });
    }
  };

  const submit = async (andNew: boolean) => {
    const errs = validateForm(form, { requireCardType: !isEdit, cardType });
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const repeatCount = canRepeat && enableRepeat ? clamp(parseInt(repeatMonths) || 1, 1, 60) : 0;
      const json = { headers: { "Content-Type": "application/json" } };
      let ids: number[] = [];
      let successMsg = "Lançamento registrado";

      if (editingId) {
        const r = await request(`/app/api/transactions/${editingId}`, { ...json, method: "PUT", body: JSON.stringify(toPayload(form, total)) });
        if (!r.ok) throw new Error(r.data?.error || "Erro ao salvar");
        ids = [editingId];
        successMsg = "Lançamento atualizado";
      } else if (installmentCount > 1) {
        const r = await request("/app/api/transactions/batch", { ...json, method: "POST", body: JSON.stringify({ base: toPayload(form, total), mode: "installments", count: installmentCount }) });
        if (!r.ok) throw new Error(r.data?.error || "Erro ao salvar");
        ids = r.data?.ids ?? [];
        successMsg = `${installmentCount}x de ${formatCurrency(installmentParts[installmentParts.length - 1])} criadas`;
      } else if (repeatCount > 0) {
        const r = await request("/app/api/transactions/batch", { ...json, method: "POST", body: JSON.stringify({ base: toPayload(form, total), mode: "repeat", count: repeatCount }) });
        if (!r.ok) throw new Error(r.data?.error || "Erro ao salvar");
        ids = r.data?.ids ?? [];
        successMsg = `Lançamento registrado + ${repeatCount} repetiç${repeatCount > 1 ? "ões" : "ão"} criada${repeatCount > 1 ? "s" : ""}`;
      } else {
        const r = await request("/app/api/transactions", { ...json, method: "POST", body: JSON.stringify(toPayload(form, total)) });
        if (!r.ok || !r.data?.id) throw new Error(r.data?.error || "Erro ao salvar");
        ids = [r.data.id];
      }

      if (pendingFiles.length > 0) {
        setIsUploading(true);
        await uploadFiles(ids[0]);
        setIsUploading(false);
      }

      localStorage.setItem(LAST_HOME_KEY, form.home_id);
      notifySaved();
      toast({ title: successMsg });

      if (andNew) {
        setForm((f) => ({
          ...emptyForm(),
          type: f.type,
          home_id: f.home_id,
          date: f.date,
          payment_method: f.payment_method,
          status: f.status,
          payment_date: f.status === "PAID" ? f.payment_date : "",
        }));
        resetExtras();
        setTimeout(() => amountRef.current?.focus(), 50);
      } else {
        close();
      }
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Erro ao salvar lançamento", variant: "destructive" });
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  };

  const handleQuickAddCompany = async () => {
    const name = quickCompany.trim();
    if (!name) return;
    setIsSavingCompany(true);
    try {
      const r = await request("/app/api/companies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      if (!r.ok || !r.data?.id) throw new Error(r.data?.error || "Erro ao criar empresa");
      addCompany({ id: r.data.id, name, is_active: true });
      set("company_id", String(r.data.id));
      setQuickCompany("");
      setShowQuickCompany(false);
      toast({ title: `Empresa "${name}" criada e selecionada` });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Erro de conexão", variant: "destructive" });
    } finally {
      setIsSavingCompany(false);
    }
  };

  const title = isEdit ? "Editar lançamento" : mode === "duplicate" ? "Duplicar lançamento" : "Novo lançamento";
  const busy = isSaving || isUploading;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <SheetContent side="right" size="md" mobileSide="full" className="gap-0">
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => { e.preventDefault(); submit(false); }}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              submit(!isEdit);
            }
          }}
        >
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>
              {isEdit ? "Altere os dados e salve." : "Enter salva · Ctrl+Enter salva e começa outro"}
            </SheetDescription>
          </SheetHeader>

          <SheetBody className="space-y-5 pb-6">
            {/* Tipo */}
            <ToggleGroup
              type="single"
              full
              size="lg"
              value={form.type}
              onValueChange={(v) => { if (v) setForm((f) => ({ ...f, type: v as TransactionFormValues["type"], category_id: "" })); }}
            >
              <ToggleGroupItem value="EXPENSE" className="data-[state=on]:text-danger">Despesa</ToggleGroupItem>
              <ToggleGroupItem value="REVENUE" className="data-[state=on]:text-success">Receita</ToggleGroupItem>
            </ToggleGroup>

            {/* Valor */}
            <div className="space-y-1.5">
              <Label htmlFor="tx-amount">Valor *</Label>
              <InputGroup className="h-14 has-[[data-slot=input-group-control]:focus-visible]:ring-[3px]">
                <InputGroupAddon>
                  <InputGroupText className="text-lg">R$</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id="tx-amount"
                  ref={amountRef}
                  inputMode="numeric"
                  placeholder="0,00"
                  autoComplete="off"
                  value={form.amount}
                  onChange={(e) => set("amount", formatInputCurrency(e.target.value))}
                  aria-invalid={!!errors.amount}
                  className="h-14 text-2xl font-semibold tabular-nums md:h-14 md:text-2xl"
                />
              </InputGroup>
              <FieldError message={errors.amount} />
            </div>

            {/* Categoria */}
            <div className="space-y-1.5">
              <Label htmlFor="tx-category">Categoria *</Label>
              <CategoryCombobox
                id="tx-category"
                kind={form.type}
                value={form.category_id}
                onValueChange={(v) => set("category_id", v)}
                invalid={!!errors.category_id}
              />
              <FieldError message={errors.category_id} />
            </div>

            {/* Centro de custo */}
            <div className="space-y-1.5">
              <Label htmlFor="tx-home">Centro de custo *</Label>
              <Select value={form.home_id} onValueChange={(v) => set("home_id", v)}>
                <SelectTrigger id="tx-home" className="w-full" aria-invalid={!!errors.home_id}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {homes.map((h) => (
                    <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors.home_id} />
            </div>

            {/* Data */}
            <div className="space-y-1.5">
              <Label htmlFor="tx-date">Data *</Label>
              <div className="flex gap-2">
                <Input
                  id="tx-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => set("date", e.target.value)}
                  aria-invalid={!!errors.date}
                  className="flex-1"
                />
                <Button type="button" variant={form.date === todayISO() ? "secondary" : "outline"} size="sm" className="h-11 md:h-9" onClick={() => set("date", todayISO())}>
                  Hoje
                </Button>
                <Button type="button" variant={form.date === addDays(todayISO(), -1) ? "secondary" : "outline"} size="sm" className="h-11 md:h-9" onClick={() => set("date", addDays(todayISO(), -1))}>
                  Ontem
                </Button>
              </div>
              <FieldError message={errors.date} />
            </div>

            {/* Forma de pagamento */}
            <div className="space-y-1.5">
              <Label>Forma de pagamento *</Label>
              <ToggleGroup
                type="single"
                value={form.payment_method}
                onValueChange={(v) => { if (v) set("payment_method", v); }}
                className="flex flex-wrap"
              >
                {PAYMENT_METHODS.map((m) => (
                  <ToggleGroupItem key={m.value} value={m.value}>{m.label}</ToggleGroupItem>
                ))}
              </ToggleGroup>
              <FieldError message={errors.payment_method} />

              {form.payment_method === "CARD" && (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <ToggleGroup type="single" full value={cardType} onValueChange={(v) => setCardType((v || "") as typeof cardType)}>
                    <ToggleGroupItem value="debit">Débito</ToggleGroupItem>
                    <ToggleGroupItem value="credit">Crédito</ToggleGroupItem>
                  </ToggleGroup>
                  <FieldError message={errors.cardType} />
                  {isCardCredit && !editingId && (
                    <div className="flex items-center gap-3">
                      <Label htmlFor="tx-installments" className="shrink-0">Parcelas</Label>
                      <Input
                        id="tx-installments"
                        type="number"
                        min={1}
                        max={48}
                        value={installments}
                        onChange={(e) => setInstallments(e.target.value)}
                        className="w-20"
                      />
                      {installmentCount > 1 && total > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {installmentCount}x de {formatCurrency(installmentParts[installmentParts.length - 1])}
                          {installmentParts[0] !== installmentParts[installmentParts.length - 1] && (
                            <> · 1ª {formatCurrency(installmentParts[0])}</>
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label>Status</Label>
              <ToggleGroup type="single" full value={form.status} onValueChange={(v) => { if (v) setStatus(v as TransactionFormValues["status"]); }}>
                <ToggleGroupItem value="PENDING">Pendente</ToggleGroupItem>
                <ToggleGroupItem value="PAID" className="data-[state=on]:text-success">Pago</ToggleGroupItem>
                <ToggleGroupItem value="CANCELED">Cancelado</ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Mais detalhes */}
            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <CollapsibleTrigger asChild>
                <button type="button" className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                  Mais detalhes
                  <ChevronDown className={cn("size-4 transition-transform", detailsOpen && "rotate-180")} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="tx-due">Vencimento</Label>
                      <button type="button" className="text-xs text-muted-foreground underline" onClick={() => set("due_date", form.date)}>
                        Repetir data
                      </button>
                    </div>
                    <Input id="tx-due" type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="tx-paid">Data de pagamento</Label>
                      <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setForm((f) => ({ ...f, payment_date: f.date, status: "PAID" }))}>
                        Repetir data
                      </button>
                    </div>
                    <Input
                      id="tx-paid"
                      type="date"
                      value={form.payment_date}
                      onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value, status: e.target.value ? "PAID" : f.status }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="tx-employee">Funcionário</Label>
                    <Select value={form.employee_id || NONE} onValueChange={(v) => set("employee_id", v === NONE ? "" : v)}>
                      <SelectTrigger id="tx-employee" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Nenhum</SelectItem>
                        {employees
                          .filter((e) => e.is_active || String(e.id) === form.employee_id)
                          .map((e) => (
                            <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="tx-company">Empresa</Label>
                      {!showQuickCompany && (
                        <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setShowQuickCompany(true)}>
                          + Nova
                        </button>
                      )}
                    </div>
                    {showQuickCompany ? (
                      <div className="flex gap-1.5">
                        <Input
                          autoFocus
                          placeholder="Nome da empresa"
                          value={quickCompany}
                          onChange={(e) => setQuickCompany(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); handleQuickAddCompany(); }
                            if (e.key === "Escape") { e.preventDefault(); setShowQuickCompany(false); setQuickCompany(""); }
                          }}
                        />
                        <Button type="button" size="icon" variant="secondary" disabled={isSavingCompany} onClick={handleQuickAddCompany} aria-label="Criar empresa">
                          {isSavingCompany ? <Loader2 className="animate-spin" /> : <Plus />}
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => { setShowQuickCompany(false); setQuickCompany(""); }}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Select value={form.company_id || NONE} onValueChange={(v) => set("company_id", v === NONE ? "" : v)}>
                        <SelectTrigger id="tx-company" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Nenhuma</SelectItem>
                          {companies
                            .filter((c) => c.is_active || String(c.id) === form.company_id)
                            .map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tx-description">Descrição</Label>
                  <Input id="tx-description" placeholder="Breve descrição do lançamento" value={form.description} onChange={(e) => set("description", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tx-notes">Observações</Label>
                  <Textarea id="tx-notes" placeholder="Anotações adicionais" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
                </div>

                {canRepeat && (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                    <Switch id="tx-repeat" checked={enableRepeat} onCheckedChange={setEnableRepeat} />
                    <Label htmlFor="tx-repeat" className="cursor-pointer">Repetir nos próximos</Label>
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={repeatMonths}
                      disabled={!enableRepeat}
                      onChange={(e) => setRepeatMonths(e.target.value)}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">meses</span>
                  </div>
                )}

                <AttachmentsField
                  pendingFiles={pendingFiles}
                  onPendingChange={setPendingFiles}
                  existing={existingAttachments}
                  onExistingChange={setExistingAttachments}
                />
              </CollapsibleContent>
            </Collapsible>
          </SheetBody>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={close} disabled={busy}>
              Cancelar
            </Button>
            {!isEdit && (
              <Button type="button" variant="secondary" disabled={busy} onClick={() => submit(true)}>
                Salvar e novo
              </Button>
            )}
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {isUploading ? "Enviando arquivos..." : "Salvar"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
