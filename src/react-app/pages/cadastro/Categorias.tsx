import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/react-app/components/ui/card";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import { Textarea } from "@/react-app/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/react-app/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/react-app/components/ui/table";
import { Badge } from "@/react-app/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/react-app/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/react-app/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/react-app/components/ui/tabs";
import { Tag, Plus, Pencil, Trash2, Search, TrendingUp, TrendingDown, Loader2, ChevronRight, Lightbulb } from "lucide-react";
import { categorySuggestions } from "@/react-app/data/categorySuggestions";

interface Categoria {
  id: number;
  name: string;
  kind: "REVENUE" | "EXPENSE";
  notes: string;
  parent_id: number | null;
}

const emptyForm = {
  name: "",
  kind: "EXPENSE" as "REVENUE" | "EXPENSE",
  notes: "",
  parent_id: null as number | null,
};

export default function CategoriasPage() {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState<"form" | "suggestions">("suggestions");
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<number>>(new Set());
  const [hasHomes, setHasHomes] = useState(true);
  const [showWarningModal, setShowWarningModal] = useState(false);

  const fetchCategorias = async () => {
    try {
      const res = await fetch("/api/categories", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCategorias(data);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
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
    fetchCategorias();
    checkHomes();
  }, []);

  // Organize categories hierarchically
  const { parentCategories, childrenByParent, hierarchicalList } = useMemo(() => {
    const parents = categorias.filter(c => !c.parent_id);
    const children: Record<number, Categoria[]> = {};
    
    categorias.forEach(c => {
      if (c.parent_id) {
        if (!children[c.parent_id]) children[c.parent_id] = [];
        children[c.parent_id].push(c);
      }
    });

    // Build flat list with hierarchy preserved - only show children if parent is expanded
    const list: (Categoria & { isChild?: boolean })[] = [];
    parents.forEach(parent => {
      list.push(parent);
      if (children[parent.id] && expandedCategories.has(parent.id)) {
        children[parent.id].forEach(child => {
          list.push({ ...child, isChild: true });
        });
      }
    });

    return { parentCategories: parents, childrenByParent: children, hierarchicalList: list };
  }, [categorias, expandedCategories]);

  const toggleCategory = (categoryId: number) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const hasChildren = (categoryId: number) => {
    return childrenByParent[categoryId] && childrenByParent[categoryId].length > 0;
  };

  const toggleSuggestion = (index: number) => {
    setExpandedSuggestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Filter available parent categories based on current kind
  const availableParents = useMemo(() => {
    return parentCategories.filter(c => c.kind === form.kind);
  }, [parentCategories, form.kind]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const url = editingId ? `/api/categories/${editingId}` : "/api/categories";
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
        fetchCategorias();
      }
    } catch (error) {
      console.error("Error saving category:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (categoria: Categoria) => {
    setForm({
      name: categoria.name || "",
      kind: categoria.kind,
      notes: categoria.notes || "",
      parent_id: categoria.parent_id,
    });
    setEditingId(categoria.id);
    setActiveTab("form");
    setIsOpen(true);
  };

  const handleDelete = async (id: number) => {
    // Check if category has children
    const hasChildren = childrenByParent[id]?.length > 0;
    const message = hasChildren 
      ? "Esta categoria possui subcategorias. Ao excluir, as subcategorias também serão excluídas. Deseja continuar?"
      : "Tem certeza que deseja excluir esta categoria?";
    
    if (!confirm(message)) return;

    try {
      // Delete children first if any
      if (hasChildren) {
        for (const child of childrenByParent[id]) {
          const childRes = await fetch(`/api/categories/${child.id}`, { method: "DELETE", credentials: "include" });
          if (!childRes.ok) {
            const errorData = await childRes.json();
            alert(errorData.error || "Erro ao excluir subcategoria");
            return;
          }
        }
      }
      
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        fetchCategorias();
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Erro ao excluir categoria");
      }
    } catch (error) {
      console.error("Error deleting category:", error);
      alert("Erro ao excluir categoria");
    }
  };

  const handleOpenNew = () => {
    if (!hasHomes) {
      alert("É necessário cadastrar pelo menos 1 Centro de Custo antes de cadastrar categorias.");
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    setActiveTab("suggestions");
    setIsOpen(true);
  };

  const handleOpenNewSubcategory = (parent: Categoria) => {
    setForm({
      name: "",
      kind: parent.kind,
      notes: "",
      parent_id: parent.id,
    });
    setEditingId(null);
    setActiveTab("form");
    setIsOpen(true);
  };

  const handleSuggestionClick = (parentName: string, subcategoryName: string | null, kind: "REVENUE" | "EXPENSE") => {
    if (!subcategoryName) {
      // Main category clicked
      setForm({
        name: parentName,
        kind: kind,
        notes: "",
        parent_id: null,
      });
      setActiveTab("form");
    } else {
      // Subcategory clicked - check if parent exists
      const existingParent = categorias.find(
        c => c.name.toUpperCase() === parentName.toUpperCase() && c.kind === kind && !c.parent_id
      );
      
      if (existingParent) {
        setForm({
          name: subcategoryName,
          kind: kind,
          notes: "",
          parent_id: existingParent.id,
        });
        setActiveTab("form");
      }
      // If parent doesn't exist, do nothing (button will be disabled)
    }
  };

  const checkParentExists = (parentName: string, kind: "REVENUE" | "EXPENSE") => {
    return categorias.some(
      c => c.name.toUpperCase() === parentName.toUpperCase() && c.kind === kind && !c.parent_id
    );
  };

  const handleAddCompleteCategory = async (parentName: string, subcategories: string[], kind: "REVENUE" | "EXPENSE") => {
    setIsSaving(true);
    
    try {
      // Create parent category first
      const parentRes = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: parentName,
          kind: kind,
          notes: "",
          parent_id: null,
        }),
        credentials: "include",
      });

      if (!parentRes.ok) {
        throw new Error("Failed to create parent category");
      }

      const parentData = await parentRes.json();
      const parentId = parentData.id;

      // Create all subcategories
      for (const subName of subcategories) {
        await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: subName,
            kind: kind,
            notes: "",
            parent_id: parentId,
          }),
          credentials: "include",
        });
      }

      // Refresh categories list
      await fetchCategorias();
      setIsOpen(false);
    } catch (error) {
      console.error("Error creating complete category:", error);
      alert("Erro ao criar categoria completa. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleKindChange = (kind: "REVENUE" | "EXPENSE") => {
    setForm({ ...form, kind, parent_id: null }); // Reset parent when kind changes
  };

  const filtered = hierarchicalList.filter((c) =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  const getParentName = (parentId: number | null) => {
    if (!parentId) return null;
    const parent = categorias.find(c => c.id === parentId);
    return parent?.name;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tag className="w-7 h-7 text-primary" />
            Categorias
          </h1>
          <p className="text-muted-foreground mt-1">
            Cadastre tipos de contas a pagar e receber
          </p>
        </div>
        <Button onClick={handleOpenNew} className="gap-2" disabled={!hasHomes}>
          <Plus className="w-4 h-4" />
          Nova Categoria
        </Button>
      </div>

      {/* Warning Modal */}
      <Dialog open={showWarningModal} onOpenChange={setShowWarningModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>⚠️ Centro de Custo Necessário</DialogTitle>
            <DialogDescription>
              É necessário cadastrar pelo menos 1 <strong>Centro de Custo</strong> antes de criar categorias.
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
            <DialogDescription>
              {editingId 
                ? (form.parent_id ? `Subcategoria de: ${getParentName(form.parent_id)}` : "Categoria principal")
                : "Escolha uma sugestão ou preencha manualmente"}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "form" | "suggestions")} className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="suggestions" disabled={!!editingId}>
                <Lightbulb className="w-4 h-4 mr-2" />
                Sugestões
              </TabsTrigger>
              <TabsTrigger value="form">Formulário</TabsTrigger>
            </TabsList>

            <TabsContent value="suggestions" className="space-y-4 mt-4">
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {categorySuggestions.map((suggestion, idx) => {
                  const parentExists = checkParentExists(suggestion.parent, suggestion.kind);
                  
                  return (
                    <Card key={idx} className="overflow-hidden">
                      <div className="p-3 flex items-center justify-between">
                        <div 
                          className="flex items-center gap-2 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleSuggestionClick(suggestion.parent, null, suggestion.kind)}
                        >
                          <Badge
                            variant="secondary"
                            className={
                              suggestion.kind === "REVENUE"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            }
                          >
                            {suggestion.kind === "REVENUE" ? (
                              <TrendingUp className="w-3 h-3 mr-1" />
                            ) : (
                              <TrendingDown className="w-3 h-3 mr-1" />
                            )}
                            {suggestion.kind === "REVENUE" ? "Receita" : "Despesa"}
                          </Badge>
                          <span className="font-semibold">{suggestion.parent}</span>
                          {parentExists && (
                            <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              Já adicionada
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {!parentExists && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddCompleteCategory(suggestion.parent, suggestion.subcategories, suggestion.kind);
                              }}
                              disabled={isSaving}
                              title="Adicionar categoria completa com todas subcategorias"
                            >
                              {isSaving ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <Plus className="w-3 h-3" />
                                  Adicionar
                                </>
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 p-0"
                            onClick={() => toggleSuggestion(idx)}
                          >
                            <ChevronRight 
                              className={`w-4 h-4 text-muted-foreground transition-transform ${
                                expandedSuggestions.has(idx) ? 'rotate-90' : ''
                              }`}
                            />
                          </Button>
                        </div>
                      </div>
                      {expandedSuggestions.has(idx) && (
                        <CardContent className="p-0">
                          <div className="grid grid-cols-2 gap-px bg-border">
                            {suggestion.subcategories.map((sub, subIdx) => (
                              <button
                                key={subIdx}
                                type="button"
                                disabled={!parentExists}
                                className={`p-2 text-sm bg-background text-left flex items-center gap-2 ${
                                  parentExists 
                                    ? "hover:bg-muted transition-colors cursor-pointer" 
                                    : "opacity-50 cursor-not-allowed"
                                }`}
                                onClick={() => handleSuggestionClick(suggestion.parent, sub, suggestion.kind)}
                                title={!parentExists ? `Cadastre "${suggestion.parent}" primeiro` : ""}
                              >
                                <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                <span>{sub}</span>
                              </button>
                            ))}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="form" className="mt-4">
              <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                placeholder={form.parent_id ? "Ex: IPVA, IPTU, ISS" : "Ex: Impostos, Mercado, Salário"}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-3">
              <Label>Tipo *</Label>
              <RadioGroup
                value={form.kind}
                onValueChange={(value) => handleKindChange(value as "REVENUE" | "EXPENSE")}
                className="flex gap-4"
                disabled={!!form.parent_id} // Can't change type if it's a subcategory
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="EXPENSE" id="expense" disabled={!!form.parent_id} />
                  <Label htmlFor="expense" className={`flex items-center gap-2 cursor-pointer ${form.parent_id ? 'opacity-50' : ''}`}>
                    <TrendingDown className="w-4 h-4 text-red-500" />
                    Despesa
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="REVENUE" id="revenue" disabled={!!form.parent_id} />
                  <Label htmlFor="revenue" className={`flex items-center gap-2 cursor-pointer ${form.parent_id ? 'opacity-50' : ''}`}>
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    Receita
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            {/* Parent category selector - only show if not already a subcategory being edited */}
            {(!editingId || !categorias.find(c => c.id === editingId)?.parent_id) && availableParents.length > 0 && (
              <div className="space-y-2">
                <Label>Categoria Pai (opcional)</Label>
                <Select 
                  value={form.parent_id?.toString() || "none"} 
                  onValueChange={(value) => setForm({ ...form, parent_id: value === "none" ? null : Number(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhuma (categoria principal)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma (categoria principal)</SelectItem>
                    {availableParents
                      .filter(p => p.id !== editingId) // Can't be parent of itself
                      .map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Selecione uma categoria pai para criar uma subcategoria
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Descrição da categoria"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Salvar
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar categoria..."
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
                      <TableHead>Tipo</TableHead>
                      <TableHead>Observações</TableHead>
                      <TableHead className="w-[140px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          {categorias.length === 0
                            ? "Nenhuma categoria cadastrada. Clique em 'Nova Categoria' para começar."
                            : "Nenhuma categoria encontrada com os filtros atuais."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((c) => (
                        <TableRow key={c.id} className={(c as any).isChild ? "bg-muted/30" : ""}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2 justify-between">
                              <div className="flex items-center gap-2">
                                {(c as any).isChild && (
                                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-6" />
                                )}
                                {c.name}
                              </div>
                              {!c.parent_id && hasChildren(c.id) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 p-0"
                                  onClick={() => toggleCategory(c.id)}
                                >
                                  <ChevronRight 
                                    className={`w-4 h-4 text-muted-foreground transition-transform ${
                                      expandedCategories.has(c.id) ? 'rotate-90' : ''
                                    }`}
                                  />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={
                                c.kind === "REVENUE"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              }
                            >
                              {c.kind === "REVENUE" ? (
                                <TrendingUp className="w-3 h-3 mr-1" />
                              ) : (
                                <TrendingDown className="w-3 h-3 mr-1" />
                              )}
                              {c.kind === "REVENUE" ? "Receita" : "Despesa"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{c.notes || "-"}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {/* Add subcategory button - only for parent categories */}
                              {!c.parent_id && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleOpenNewSubcategory(c)}
                                  title="Adicionar subcategoria"
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(c)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(c.id)}
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
                    {categorias.length === 0
                      ? "Nenhuma categoria cadastrada. Clique em 'Nova Categoria' para começar."
                      : "Nenhuma categoria encontrada."}
                  </div>
                ) : (
                  filtered.map((c) => (
                    <div key={c.id} className={`p-4 space-y-2 ${(c as any).isChild ? "bg-muted/30 pl-8" : ""}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 justify-between">
                            <div className="flex items-center gap-2">
                              {(c as any).isChild && (
                                <ChevronRight className="w-4 h-4 text-muted-foreground ml-6" />
                              )}
                              <p className="font-semibold">{c.name}</p>
                              <Badge
                                variant="secondary"
                                className={
                                  c.kind === "REVENUE"
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                }
                              >
                                {c.kind === "REVENUE" ? "Receita" : "Despesa"}
                              </Badge>
                            </div>
                            {!c.parent_id && hasChildren(c.id) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 p-0"
                                onClick={() => toggleCategory(c.id)}
                              >
                                <ChevronRight 
                                  className={`w-4 h-4 text-muted-foreground transition-transform ${
                                    expandedCategories.has(c.id) ? 'rotate-90' : ''
                                  }`}
                                />
                              </Button>
                            )}
                          </div>
                          {c.notes && <p className="text-sm text-muted-foreground">{c.notes}</p>}
                        </div>
                        <div className="flex gap-1">
                          {!c.parent_id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleOpenNewSubcategory(c)}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(c)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(c.id)}
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
