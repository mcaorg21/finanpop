import { useEffect, useMemo, useState } from "react";
import { Building2, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";

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
import { Textarea } from "@/react-app/components/ui/textarea";
import { PageHeader } from "@/react-app/components/app/PageHeader";
import { ResponsiveList, type Column } from "@/react-app/components/app/ResponsiveList";
import { RowActionsMenu } from "@/react-app/components/app/RowActionsMenu";
import { useAlert } from "@/react-app/hooks/use-alert";
import { useReferenceData } from "@/react-app/hooks/use-reference-data";
import { useToast } from "@/react-app/hooks/use-toast";
import { formatCEP } from "@/react-app/lib/format";

interface Domicilio {
  id: number;
  name: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
}

// Mesmos campos do formulário antigo.
const emptyForm: Omit<Domicilio, "id"> = {
  name: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "", zip: "", notes: "",
};

export default function DomiciliosPage() {
  const { toast } = useToast();
  const { confirm } = useAlert();
  const refreshReference = useReferenceData((s) => s.refresh);

  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [domicilios, setDomicilios] = useState<Domicilio[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchDomicilios = async () => {
    try {
      const res = await fetch("/app/api/homes", { credentials: "include" });
      if (res.ok) {
        setDomicilios(await res.json());
      } else {
        const error = await res.json();
        toast({ title: "Erro ao carregar centros de custo", description: error.error || "Tente novamente", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro de conexão", description: "Não foi possível carregar os centros de custo", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDomicilios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAddressByCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    setIsFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (res.ok) {
        const data = await res.json();
        if (!data.erro) {
          setForm((prev) => ({
            ...prev,
            street: data.logradouro || prev.street,
            neighborhood: data.bairro || prev.neighborhood,
            city: data.localidade || prev.city,
            state: data.uf || prev.state,
          }));
          toast({ title: "Endereço encontrado", description: `${data.logradouro}, ${data.bairro} - ${data.localidade}/${data.uf}` });
        } else {
          toast({ title: "CEP não encontrado", description: "Verifique o CEP digitado", variant: "destructive" });
        }
      }
    } catch {
      toast({ title: "Erro ao buscar CEP", description: "Não foi possível consultar o CEP", variant: "destructive" });
    } finally {
      setIsFetchingCep(false);
    }
  };

  const handleCepChange = (value: string) => {
    const formatted = formatCEP(value);
    setForm((prev) => ({ ...prev, zip: formatted }));
    if (formatted.replace(/\D/g, "").length === 8) fetchAddressByCep(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const url = editingId ? `/app/api/homes/${editingId}` : "/app/api/homes";
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setIsOpen(false);
        setForm(emptyForm);
        setEditingId(null);
        fetchDomicilios();
        refreshReference();
        toast({ title: editingId ? "Centro de custo atualizado" : "Centro de custo criado", description: `${form.name} foi salvo com sucesso` });
      } else {
        toast({ title: "Erro ao salvar", description: data.error || "Verifique os dados e tente novamente", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro de conexão", description: "Não foi possível salvar o centro de custo", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (d: Domicilio) => {
    setForm({
      name: d.name || "", street: d.street || "", number: d.number || "", complement: d.complement || "",
      neighborhood: d.neighborhood || "", city: d.city || "", state: d.state || "", zip: d.zip || "", notes: d.notes || "",
    });
    setEditingId(d.id);
    setIsOpen(true);
  };

  const handleDelete = async (d: Domicilio) => {
    const ok = await confirm({
      title: "Excluir centro de custo?",
      message: `"${d.name}" será removido. Esta ação não pode ser desfeita.`,
      confirmText: "Excluir",
      cancelText: "Cancelar",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/app/api/homes/${d.id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        fetchDomicilios();
        refreshReference();
        toast({ title: "Centro de custo excluído" });
      } else {
        const data = await res.json();
        toast({ title: "Erro ao excluir", description: data.error || "Tente novamente", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro de conexão", description: "Não foi possível excluir o centro de custo", variant: "destructive" });
    }
  };

  const handleOpenNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setIsOpen(true);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return domicilios;
    return domicilios.filter((d) => d.name?.toLowerCase().includes(q) || d.city?.toLowerCase().includes(q));
  }, [domicilios, search]);

  const address = (d: Domicilio) => (d.street ? `${d.street}, ${d.number || "s/n"}${d.complement ? ` - ${d.complement}` : ""}` : "—");
  const cityState = (d: Domicilio) => (d.city && d.state ? `${d.city}/${d.state}` : d.city || d.state || "—");
  const actionsFor = (d: Domicilio) => [
    { label: "Editar", icon: Pencil, onSelect: () => handleEdit(d) },
    { label: "Excluir", icon: Trash2, destructive: true, separatorBefore: true, onSelect: () => handleDelete(d) },
  ];

  const columns: Column<Domicilio>[] = [
    { key: "name", header: "Nome", cell: (d) => <span className="font-medium">{d.name}</span> },
    { key: "address", header: "Endereço", cell: (d) => <span className="text-muted-foreground">{address(d)}</span> },
    { key: "city", header: "Cidade/UF", cell: (d) => <span className="text-muted-foreground">{cityState(d)}</span> },
    { key: "actions", header: "", align: "right", className: "w-12", cell: (d) => <RowActionsMenu actions={actionsFor(d)} /> },
  ];

  const renderCard = (d: Domicilio) => (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{d.name}</p>
        {d.street && <p className="truncate text-sm text-muted-foreground">{address(d)}</p>}
        {(d.city || d.state) && <p className="text-sm text-muted-foreground">{cityState(d)}</p>}
      </div>
      <RowActionsMenu actions={actionsFor(d)} className="-mr-2" />
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Centros de Custo"
        description="Locais, projetos ou contas que você acompanha separadamente"
        actions={
          <Button onClick={handleOpenNew}>
            <Plus /> Novo centro de custo
          </Button>
        }
        toolbar={
          <InputGroup className="w-full sm:w-80">
            <InputGroupAddon><Search /></InputGroupAddon>
            <InputGroupInput placeholder="Buscar por nome ou cidade..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
        rowKey={(d) => d.id}
        renderCard={renderCard}
        breakpoint="md"
        isLoading={isLoading}
        onRowClick={handleEdit}
        emptyState={
          domicilios.length === 0 ? (
            <EmptyState icon={Building2} title="Nenhum centro de custo" description="Cadastre o primeiro para começar a lançar receitas e despesas." action={<Button size="sm" onClick={handleOpenNew}><Plus /> Novo centro de custo</Button>} />
          ) : (
            <EmptyState icon={Search} title="Nenhum resultado" description="Nenhum centro de custo corresponde à busca." />
          )
        }
      />

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent size="md" mobileSide="full">
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <SheetHeader>
              <SheetTitle>{editingId ? "Editar centro de custo" : "Novo centro de custo"}</SheetTitle>
              <SheetDescription>Digite o CEP para preencher o endereço automaticamente.</SheetDescription>
            </SheetHeader>
            <SheetBody className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome do centro de custo *</Label>
                <Input id="name" placeholder="Ex: Casa BH, Apto RJ" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="zip">CEP</Label>
                  <div className="relative">
                    <Input id="zip" placeholder="00000-000" inputMode="numeric" value={form.zip} onChange={(e) => handleCepChange(e.target.value)} maxLength={9} />
                    {isFetchingCep && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="state">UF</Label>
                  <Input id="state" placeholder="MG" maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="street">Logradouro</Label>
                  <Input id="street" placeholder="Rua, Avenida..." value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="number">Número</Label>
                  <Input id="number" placeholder="123" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="complement">Complemento</Label>
                  <Input id="complement" placeholder="Apto, Casa..." value={form.complement} onChange={(e) => setForm({ ...form, complement: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="neighborhood">Bairro</Label>
                  <Input id="neighborhood" placeholder="Nome do bairro" value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city">Cidade</Label>
                  <Input id="city" placeholder="Nome da cidade" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Observações</Label>
                <Textarea id="notes" placeholder="Anotações sobre o centro de custo" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </SheetBody>
            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="animate-spin" />} Salvar
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
