import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronRight, CornerDownRight, Loader2, Pencil, Plus, Search, Tags, Trash2, X } from "lucide-react";

import { cn } from "@/react-app/lib/utils";
import { Badge } from "@/react-app/components/ui/badge";
import { Button } from "@/react-app/components/ui/button";
import { EmptyState } from "@/react-app/components/ui/empty-state";
import { Input } from "@/react-app/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/react-app/components/ui/input-group";
import { Label } from "@/react-app/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/react-app/components/ui/radio-group";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/react-app/components/ui/tabs";
import { Textarea } from "@/react-app/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/react-app/components/ui/toggle-group";
import { PageHeader } from "@/react-app/components/app/PageHeader";
import { ResponsiveList, type Column } from "@/react-app/components/app/ResponsiveList";
import { RowActionsMenu } from "@/react-app/components/app/RowActionsMenu";
import { categorySuggestions } from "@/react-app/data/categorySuggestions";
import { useAlert } from "@/react-app/hooks/use-alert";
import { useReferenceData } from "@/react-app/hooks/use-reference-data";
import { useToast } from "@/react-app/hooks/use-toast";
import { typeLabels } from "@/react-app/lib/labels";

type Kind = "REVENUE" | "EXPENSE";

interface Categoria {
  id: number;
  name: string;
  kind: Kind;
  notes: string;
  parent_id: number | null;
}

type Row = Categoria & { isChild: boolean; childCount: number };

// Mesmos campos do formulário antigo.
const emptyForm = { name: "", kind: "EXPENSE" as Kind, notes: "", parent_id: null as number | null };
const NONE = "__none";
const ALL = "ALL";

export default function CategoriasPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { confirm, error: showError } = useAlert();
  const refreshReference = useReferenceData((s) => s.refresh);

  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<string>(ALL);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState<"form" | "suggestions">("suggestions");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<number>>(new Set());
  const [hasHomes, setHasHomes] = useState(true);

  const fetchCategorias = async () => {
    try {
      const res = await fetch("/app/api/categories", { credentials: "include" });
      if (res.ok) setCategorias(await res.json());
    } catch {
      toast({ title: "Erro ao carregar categorias", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategorias();
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
      message: "Cadastre pelo menos um centro de custo antes de criar categorias. Ele organiza receitas e despesas por unidade, projeto ou conta.",
      confirmText: "Ir para centros de custo",
      cancelText: "Agora não",
    });
    if (go) navigate("/cadastro/domicilios");
    return false;
  };

  // ── Hierarquia ────────────────────────────────────────────────
  const { parents, childrenByParent } = useMemo(() => {
    const parents = categorias.filter((c) => !c.parent_id).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    const children: Record<number, Categoria[]> = {};
    for (const c of categorias) {
      if (c.parent_id) (children[c.parent_id] ??= []).push(c);
    }
    for (const list of Object.values(children)) list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return { parents, childrenByParent: children };
  }, [categorias]);

  const rows = useMemo<Row[]>(() => {
    const q = search.trim().toLowerCase();
    const out: Row[] = [];
    for (const p of parents) {
      if (kindFilter !== ALL && p.kind !== kindFilter) continue;
      const kids = childrenByParent[p.id] ?? [];
      const parentMatches = !q || p.name.toLowerCase().includes(q);
      const matchingKids = q ? kids.filter((k) => k.name.toLowerCase().includes(q)) : kids;
      if (!parentMatches && matchingKids.length === 0) continue;
      out.push({ ...p, isChild: false, childCount: kids.length });
      // com busca ativa, mostra as filhas que casam; sem busca, só quando expandido
      const showKids = q ? matchingKids : expanded.has(p.id) ? kids : [];
      for (const k of showKids) out.push({ ...k, isChild: true, childCount: 0 });
    }
    return out;
  }, [parents, childrenByParent, expanded, search, kindFilter]);

  const toggleExpanded = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const availableParents = useMemo(() => parents.filter((c) => c.kind === form.kind && c.id !== editingId), [parents, form.kind, editingId]);
  const parentName = (id: number | null) => (id ? categorias.find((c) => c.id === id)?.name ?? null : null);

  // ── CRUD ──────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const url = editingId ? `/app/api/categories/${editingId}` : "/app/api/categories";
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: editingId ? "Categoria atualizada" : "Categoria criada", description: form.name });
        if (editingId) {
          setIsOpen(false);
          setEditingId(null);
        } else {
          // mesma regra antiga: ao criar, mantém o painel aberto para cadastrar outra
          if (form.parent_id) setExpanded((prev) => new Set(prev).add(form.parent_id as number));
          setActiveTab("suggestions");
        }
        setForm(emptyForm);
        fetchCategorias();
        refreshReference();
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

  const handleEdit = (c: Categoria) => {
    setForm({ name: c.name || "", kind: c.kind, notes: c.notes || "", parent_id: c.parent_id });
    setEditingId(c.id);
    setActiveTab("form");
    setIsOpen(true);
  };

  const handleDelete = async (c: Categoria) => {
    const kids = childrenByParent[c.id] ?? [];
    const ok = await confirm({
      title: "Excluir categoria?",
      message:
        kids.length > 0
          ? `"${c.name}" possui ${kids.length} subcategoria${kids.length > 1 ? "s" : ""}, que também serão excluídas. Esta ação não pode ser desfeita.`
          : `"${c.name}" será removida. Esta ação não pode ser desfeita.`,
      confirmText: "Excluir",
      cancelText: "Cancelar",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      for (const child of kids) {
        const r = await fetch(`/app/api/categories/${child.id}`, { method: "DELETE", credentials: "include" });
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          showError(data.error || `Erro ao excluir a subcategoria "${child.name}"`);
          fetchCategorias();
          return;
        }
      }
      const res = await fetch(`/app/api/categories/${c.id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        toast({ title: "Categoria excluída" });
        fetchCategorias();
        refreshReference();
      } else {
        const data = await res.json().catch(() => ({}));
        showError(data.error || "Erro ao excluir categoria");
      }
    } catch {
      showError("Erro ao excluir categoria");
    }
  };

  const handleOpenNew = async () => {
    if (!(await requireHomes())) return;
    setForm(emptyForm);
    setEditingId(null);
    setActiveTab("suggestions");
    setIsOpen(true);
  };

  const handleOpenNewSub = (parent: Categoria) => {
    setForm({ name: "", kind: parent.kind, notes: "", parent_id: parent.id });
    setEditingId(null);
    setActiveTab("form");
    setIsOpen(true);
  };

  // ── Sugestões (fluxo igual ao antigo) ─────────────────────────
  const findParent = (name: string, kind: Kind) =>
    categorias.find((c) => c.name.toUpperCase() === name.toUpperCase() && c.kind === kind && !c.parent_id);

  const handleSuggestionClick = (parentName: string, sub: string | null, kind: Kind) => {
    if (!sub) {
      setForm({ name: parentName, kind, notes: "", parent_id: null });
      setActiveTab("form");
      return;
    }
    const existing = findParent(parentName, kind);
    if (existing) {
      setForm({ name: sub, kind, notes: "", parent_id: existing.id });
      setActiveTab("form");
    }
  };

  const handleAddComplete = async (parentName: string, subs: string[], kind: Kind) => {
    setIsSaving(true);
    try {
      const parentRes = await fetch("/app/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: parentName, kind, notes: "", parent_id: null }),
        credentials: "include",
      });
      if (!parentRes.ok) throw new Error();
      const { id: parentId } = await parentRes.json();
      for (const name of subs) {
        await fetch("/app/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, kind, notes: "", parent_id: parentId }),
          credentials: "include",
        });
      }
      toast({ title: "Categoria adicionada", description: `${parentName} com ${subs.length} subcategorias` });
      await fetchCategorias();
      refreshReference();
    } catch {
      showError("Erro ao criar categoria completa. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Lista ─────────────────────────────────────────────────────
  const kindBadge = (c: Categoria) => <Badge variant={typeLabels[c.kind].variant}>{typeLabels[c.kind].label}</Badge>;
  const actionsFor = (c: Row) => [
    { label: "Adicionar subcategoria", icon: Plus, onSelect: () => handleOpenNewSub(c), hidden: c.isChild },
    { label: "Editar", icon: Pencil, onSelect: () => handleEdit(c) },
    { label: "Excluir", icon: Trash2, destructive: true, separatorBefore: true, onSelect: () => handleDelete(c) },
  ];

  const nameCell = (c: Row) => (
    <span className={cn("flex items-center gap-2", c.isChild && "pl-6")}>
      {c.isChild ? (
        <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground" />
      ) : c.childCount > 0 ? (
        <button
          type="button"
          aria-label={expanded.has(c.id) ? "Recolher subcategorias" : "Expandir subcategorias"}
          onClick={(e) => { e.stopPropagation(); toggleExpanded(c.id); }}
          className="-ml-1 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className={cn("size-4 transition-transform", expanded.has(c.id) && "rotate-90")} />
        </button>
      ) : (
        <span className="size-5 shrink-0" />
      )}
      <span className={cn("truncate", c.isChild ? "text-sm" : "font-medium")}>{c.name}</span>
      {!c.isChild && c.childCount > 0 && <span className="text-xs text-muted-foreground tabular-nums">({c.childCount})</span>}
    </span>
  );

  const columns: Column<Row>[] = [
    { key: "name", header: "Nome", cell: nameCell },
    { key: "kind", header: "Tipo", cell: kindBadge },
    { key: "notes", header: "Observações", className: "max-w-[320px] truncate", cell: (c) => <span className="text-muted-foreground">{c.notes || "—"}</span> },
    { key: "actions", header: "", align: "right", className: "w-12", cell: (c) => <RowActionsMenu actions={actionsFor(c)} /> },
  ];

  const renderCard = (c: Row) => (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2">{nameCell(c)}{kindBadge(c)}</div>
        {c.notes && <p className="truncate text-sm text-muted-foreground">{c.notes}</p>}
      </div>
      <RowActionsMenu actions={actionsFor(c)} className="-mr-2" />
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Categorias"
        description="Tipos de receitas e despesas, com subcategorias"
        actions={
          <Button onClick={handleOpenNew}>
            <Plus /> Nova categoria
          </Button>
        }
        toolbar={
          <>
            <InputGroup className="w-full sm:w-72">
              <InputGroupAddon><Search /></InputGroupAddon>
              <InputGroupInput placeholder="Buscar categoria..." value={search} onChange={(e) => setSearch(e.target.value)} />
              {search && (
                <InputGroupAddon align="inline-end">
                  <button type="button" aria-label="Limpar busca" onClick={() => setSearch("")}><X className="size-4" /></button>
                </InputGroupAddon>
              )}
            </InputGroup>
            <ToggleGroup type="single" size="sm" value={kindFilter} onValueChange={(v) => { if (v) setKindFilter(v); }}>
              <ToggleGroupItem value={ALL}>Todas</ToggleGroupItem>
              <ToggleGroupItem value="EXPENSE">Despesas</ToggleGroupItem>
              <ToggleGroupItem value="REVENUE">Receitas</ToggleGroupItem>
            </ToggleGroup>
          </>
        }
      />

      <ResponsiveList
        rows={rows}
        columns={columns}
        rowKey={(c) => c.id}
        renderCard={renderCard}
        breakpoint="md"
        isLoading={isLoading}
        onRowClick={(c) => (c.isChild || c.childCount === 0 ? handleEdit(c) : toggleExpanded(c.id))}
        rowClassName={(c) => (c.isChild ? "bg-muted/30" : undefined)}
        emptyState={
          categorias.length === 0 ? (
            <EmptyState icon={Tags} title="Nenhuma categoria" description="Use as sugestões prontas ou crie as suas." action={<Button size="sm" onClick={handleOpenNew}><Plus /> Nova categoria</Button>} />
          ) : (
            <EmptyState icon={Search} title="Nenhum resultado" description="Nenhuma categoria corresponde aos filtros." />
          )
        }
      />

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent size="lg" mobileSide="full">
          <SheetHeader>
            <SheetTitle>{editingId ? "Editar categoria" : form.parent_id && activeTab === "form" ? `Nova subcategoria de ${parentName(form.parent_id)}` : "Nova categoria"}</SheetTitle>
            <SheetDescription>
              {editingId
                ? form.parent_id ? `Subcategoria de ${parentName(form.parent_id)}` : "Categoria principal"
                : "Escolha uma sugestão pronta ou preencha manualmente."}
            </SheetDescription>
          </SheetHeader>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "form" | "suggestions")} className="flex min-h-0 flex-1 flex-col gap-0">
            <div className="px-4 pb-2 sm:px-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="suggestions" disabled={!!editingId}>Sugestões</TabsTrigger>
                <TabsTrigger value="form">Formulário</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="suggestions" className="flex min-h-0 flex-1 flex-col">
              <SheetBody className="space-y-2">
                {categorySuggestions.map((s, idx) => {
                  const exists = !!findParent(s.parent, s.kind);
                  const open = expandedSuggestions.has(idx);
                  return (
                    <div key={idx} className="overflow-hidden rounded-lg border border-border">
                      <div className="flex items-center gap-2 p-2.5">
                        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => handleSuggestionClick(s.parent, null, s.kind)}>
                          <Badge variant={typeLabels[s.kind].variant}>{typeLabels[s.kind].label}</Badge>
                          <span className="truncate font-medium">{s.parent}</span>
                          {exists && <Badge variant="success">Já adicionada</Badge>}
                        </button>
                        {!exists && (
                          <Button type="button" variant="outline" size="xs" disabled={isSaving} onClick={() => handleAddComplete(s.parent, s.subcategories, s.kind)} title="Adicionar categoria com todas as subcategorias">
                            {isSaving ? <Loader2 className="animate-spin" /> : <Plus />} Adicionar tudo
                          </Button>
                        )}
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={open ? "Recolher" : "Expandir"} onClick={() => setExpandedSuggestions((prev) => { const n = new Set(prev); if (n.has(idx)) n.delete(idx); else n.add(idx); return n; })}>
                          <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
                        </Button>
                      </div>
                      {open && (
                        <div className="grid grid-cols-2 gap-px border-t border-border bg-border">
                          {s.subcategories.map((sub) => (
                            <button
                              key={sub}
                              type="button"
                              disabled={!exists}
                              title={!exists ? `Cadastre "${s.parent}" primeiro` : undefined}
                              className={cn("flex items-center gap-2 bg-background p-2 text-left text-sm", exists ? "hover:bg-muted" : "cursor-not-allowed opacity-50")}
                              onClick={() => handleSuggestionClick(s.parent, sub, s.kind)}
                            >
                              <CornerDownRight className="size-3 shrink-0 text-muted-foreground" />
                              <span className="truncate">{sub}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </SheetBody>
              <SheetFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Fechar</Button>
              </SheetFooter>
            </TabsContent>

            <TabsContent value="form" className="flex min-h-0 flex-1 flex-col">
              <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                <SheetBody className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cat-name">Nome *</Label>
                    <Input id="cat-name" placeholder={form.parent_id ? "Ex: IPVA, IPTU, ISS" : "Ex: Impostos, Mercado, Salário"} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo *</Label>
                    <RadioGroup value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as Kind, parent_id: null })} className="flex gap-4" disabled={!!form.parent_id}>
                      <label className={cn("flex cursor-pointer items-center gap-2 text-sm", form.parent_id && "opacity-50")}>
                        <RadioGroupItem value="EXPENSE" disabled={!!form.parent_id} /> Despesa
                      </label>
                      <label className={cn("flex cursor-pointer items-center gap-2 text-sm", form.parent_id && "opacity-50")}>
                        <RadioGroupItem value="REVENUE" disabled={!!form.parent_id} /> Receita
                      </label>
                    </RadioGroup>
                  </div>
                  {(!editingId || !categorias.find((c) => c.id === editingId)?.parent_id) && availableParents.length > 0 && (
                    <div className="space-y-1.5">
                      <Label>Categoria pai (opcional)</Label>
                      <Select value={form.parent_id?.toString() ?? NONE} onValueChange={(v) => setForm({ ...form, parent_id: v === NONE ? null : Number(v) })}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Nenhuma (categoria principal)</SelectItem>
                          {availableParents.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Selecione uma categoria pai para criar uma subcategoria.</p>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="cat-notes">Observações</Label>
                    <Textarea id="cat-notes" placeholder="Descrição da categoria" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </div>
                </SheetBody>
                <SheetFooter>
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving && <Loader2 className="animate-spin" />} Salvar
                  </Button>
                </SheetFooter>
              </form>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}
