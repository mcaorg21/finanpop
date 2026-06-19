import { useState, useEffect } from "react";
import { Card, CardContent } from "@/react-app/components/ui/card";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import { Textarea } from "@/react-app/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/react-app/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/react-app/components/ui/table";
import { Building2, Plus, Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { useToast } from "@/react-app/hooks/use-toast";

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

const emptyForm: Omit<Domicilio, "id"> = {
  name: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  zip: "",
  notes: "",
};

export default function DomiciliosPage() {
  const { toast } = useToast();
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
      const res = await fetch("/api/homes", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setDomicilios(data);
      } else {
        const error = await res.json();
        toast({
          title: "Erro ao carregar centros de custo",
          description: error.error || "Tente novamente",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching homes:", error);
      toast({
        title: "Erro de conexão",
        description: "Não foi possível carregar os centros de custo",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDomicilios();
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
          toast({
            title: "Endereço encontrado",
            description: `${data.logradouro}, ${data.bairro} - ${data.localidade}/${data.uf}`,
          });
        } else {
          toast({
            title: "CEP não encontrado",
            description: "Verifique o CEP digitado",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("Error fetching CEP:", error);
      toast({
        title: "Erro ao buscar CEP",
        description: "Não foi possível consultar o CEP",
        variant: "destructive",
      });
    } finally {
      setIsFetchingCep(false);
    }
  };

  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 5) return numbers;
    return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value);
    setForm({ ...form, zip: formatted });
    
    // Auto-fetch when CEP is complete (8 digits)
    const cleanCep = formatted.replace(/\D/g, "");
    if (cleanCep.length === 8) {
      fetchAddressByCep(cleanCep);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const url = editingId ? `/api/homes/${editingId}` : "/api/homes";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
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
        toast({
          title: editingId ? "Centro de Custo atualizado" : "Centro de Custo criado",
          description: `${form.name} foi salvo com sucesso`,
        });
      } else {
        toast({
          title: "Erro ao salvar",
          description: data.error || "Verifique os dados e tente novamente",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving home:", error);
      toast({
        title: "Erro de conexão",
        description: "Não foi possível salvar o centro de custo",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (domicilio: Domicilio) => {
    setForm({
      name: domicilio.name || "",
      street: domicilio.street || "",
      number: domicilio.number || "",
      complement: domicilio.complement || "",
      neighborhood: domicilio.neighborhood || "",
      city: domicilio.city || "",
      state: domicilio.state || "",
      zip: domicilio.zip || "",
      notes: domicilio.notes || "",
    });
    setEditingId(domicilio.id);
    setIsOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este centro de custo?")) return;

    try {
      const res = await fetch(`/api/homes/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        fetchDomicilios();
        toast({
          title: "Centro de Custo excluído",
          description: "O centro de custo foi removido com sucesso",
        });
      } else {
        const data = await res.json();
        toast({
          title: "Erro ao excluir",
          description: data.error || "Tente novamente",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting home:", error);
      toast({
        title: "Erro de conexão",
        description: "Não foi possível excluir o centro de custo",
        variant: "destructive",
      });
    }
  };

  const handleOpenNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setIsOpen(true);
  };

  const filtered = domicilios.filter(
    (d) =>
      d.name?.toLowerCase().includes(search.toLowerCase()) ||
      d.city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-7 h-7 text-primary" />
            Centros de Custo
          </h1>
          <p className="text-muted-foreground mt-1">
            Cadastre e gerencie os centros de custo
          </p>
        </div>
        <Button onClick={handleOpenNew} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Centro de Custo
        </Button>
      </div>

      {/* Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Centro de Custo" : "Novo Centro de Custo"}</DialogTitle>
            <DialogDescription>
              Preencha os dados do endereço. Digite o CEP para preencher automaticamente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do centro de custo *</Label>
              <Input
                id="name"
                placeholder="Ex: Casa BH, Apto RJ"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="zip">CEP</Label>
                <div className="relative">
                  <Input
                    id="zip"
                    placeholder="00000-000"
                    value={form.zip}
                    onChange={handleCepChange}
                    maxLength={9}
                  />
                  {isFetchingCep && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Digite o CEP para preencher o endereço automaticamente
                </p>
              </div>
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="state">UF</Label>
                <Input
                  id="state"
                  placeholder="MG"
                  maxLength={2}
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="street">Logradouro</Label>
                <Input
                  id="street"
                  placeholder="Rua, Avenida..."
                  value={form.street}
                  onChange={(e) => setForm({ ...form, street: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="number">Número</Label>
                <Input
                  id="number"
                  placeholder="123"
                  value={form.number}
                  onChange={(e) => setForm({ ...form, number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="complement">Complemento</Label>
                <Input
                  id="complement"
                  placeholder="Apto, Casa..."
                  value={form.complement}
                  onChange={(e) => setForm({ ...form, complement: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input
                  id="neighborhood"
                  placeholder="Nome do bairro"
                  value={form.neighborhood}
                  onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  placeholder="Nome da cidade"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Anotações sobre o centro de custo"
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
        </DialogContent>
      </Dialog>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou cidade..."
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
                      <TableHead>Endereço</TableHead>
                      <TableHead>Cidade/UF</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          {domicilios.length === 0
                            ? "Nenhum centro de custo cadastrado. Clique em 'Novo Centro de Custo' para começar."
                            : "Nenhum centro de custo encontrado com os filtros atuais."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.name}</TableCell>
                          <TableCell>
                            {d.street ? `${d.street}, ${d.number || "s/n"}` : "-"}
                            {d.complement && ` - ${d.complement}`}
                          </TableCell>
                          <TableCell>
                            {d.city && d.state ? `${d.city}/${d.state}` : d.city || d.state || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(d)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(d.id)}
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
                    {domicilios.length === 0
                      ? "Nenhum centro de custo cadastrado. Clique em 'Novo Centro de Custo' para começar."
                      : "Nenhum centro de custo encontrado."}
                  </div>
                ) : (
                  filtered.map((d) => (
                    <div key={d.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">{d.name}</p>
                          {d.street && (
                            <p className="text-sm text-muted-foreground">
                              {d.street}, {d.number || "s/n"}
                            </p>
                          )}
                          {(d.city || d.state) && (
                            <p className="text-sm text-muted-foreground">
                              {d.city && d.state ? `${d.city}/${d.state}` : d.city || d.state}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(d)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(d.id)}
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
