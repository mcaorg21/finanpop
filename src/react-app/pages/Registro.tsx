import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import { Textarea } from "@/react-app/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/react-app/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/react-app/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/react-app/components/ui/table";
import { Badge } from "@/react-app/components/ui/badge";
import { Receipt, Plus, Pencil, Copy, Trash2, TrendingUp, TrendingDown, Wallet, Loader2, Paperclip, Camera, X, FileText, Image as ImageIcon, Eye, AlertCircle, Filter, RotateCcw, FileSpreadsheet, FileDown, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/react-app/hooks/use-toast";
import { useAlert } from "@/react-app/hooks/use-alert";

interface Attachment {
  id: number;
  transaction_id: number;
  filename: string;
  original_name: string;
  content_type: string;
  size: number;
}

interface Transaction {
  id: number;
  date: string;
  type: "REVENUE" | "EXPENSE";
  amount: number;
  home_id: number;
  home_name: string;
  category_id: number;
  category_name: string;
  employee_id: number | null;
  employee_name: string | null;
  company_id: number | null;
  company_name: string | null;
  payment_method: string;
  status: "PENDING" | "PAID" | "CANCELED";
  description: string | null;
  notes: string | null;
  attachment_count: number;
  due_date: string | null;
  payment_date: string | null;
}

interface Home {
  id: number;
  name: string;
}

interface Category {
  id: number;
  name: string;
  kind: "REVENUE" | "EXPENSE";
  parent_id: number | null;
}

interface Employee {
  id: number;
  name: string;
  is_active: number;
}

interface Company {
  id: number;
  name: string;
  is_active: number;
}

// Formata valor para exibição (1234.56 -> "1.234,56")
const formatInputCurrency = (value: string): string => {
  // Remove tudo exceto números
  const numbers = value.replace(/\D/g, "");
  if (!numbers) return "";
  
  // Converte para centavos e depois para reais
  const cents = parseInt(numbers, 10);
  const reais = (cents / 100).toFixed(2);
  
  // Formata com separadores brasileiros
  const [intPart, decPart] = reais.split(".");
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formattedInt},${decPart}`;
};

// Converte valor formatado para número (1.234,56 -> 1234.56)
const parseCurrencyToNumber = (value: string): string => {
  if (!value) return "";
  const numbers = value.replace(/\D/g, "");
  if (!numbers) return "";
  return (parseInt(numbers, 10) / 100).toString();
};

const emptyForm = {
  date: new Date().toISOString().split("T")[0],
  type: "EXPENSE" as "REVENUE" | "EXPENSE",
  amount: "", // Stored as formatted string for display
  home_id: "",
  category_id: "",
  employee_id: "",
  company_id: "",
  payment_method: "BOLETO_DDA",
  status: "PENDING",
  description: "",
  notes: "",
  due_date: "",
  payment_date: "",
};

export default function RegistroPage() {
  const { toast } = useToast();
  const { confirm } = useAlert();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [homes, setHomes] = useState<Home[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  
  // Filters
  const [filterDateStart, setFilterDateStart] = useState("");
  const [filterDateEnd, setFilterDateEnd] = useState("");
  const [filterDueDateStart, setFilterDueDateStart] = useState("");
  const [filterDueDateEnd, setFilterDueDateEnd] = useState("");
  const [filterType, setFilterType] = useState<"" | "REVENUE" | "EXPENSE">("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    try {
      const [transRes, homesRes, categoriesRes, employeesRes, companiesRes] = await Promise.all([
        fetch("/api/transactions", { credentials: "include" }),
        fetch("/api/homes", { credentials: "include" }),
        fetch("/api/categories", { credentials: "include" }),
        fetch("/api/employees", { credentials: "include" }),
        fetch("/api/companies", { credentials: "include" }),
      ]);

      if (transRes.ok) setTransactions(await transRes.json());
      if (homesRes.ok) setHomes(await homesRes.json());
      if (categoriesRes.ok) setCategories(await categoriesRes.json());
      if (employeesRes.ok) setEmployees(await employeesRes.json());
      if (companiesRes.ok) setCompanies(await companiesRes.json());
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Close category dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    };

    if (isCategoryDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isCategoryDropdownOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!form.date) newErrors.date = "Data é obrigatória";
    const numericAmount = parseFloat(parseCurrencyToNumber(form.amount));
    if (!form.amount || isNaN(numericAmount) || numericAmount <= 0) newErrors.amount = "Valor deve ser maior que zero";
    if (!form.home_id) newErrors.home_id = "Selecione um centro de custo";
    if (!form.category_id) newErrors.category_id = "Selecione uma categoria";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const uploadFiles = async (transactionId: number) => {
    for (const file of pendingFiles) {
      const formData = new FormData();
      formData.append("file", file);
      
      await fetch(`/api/transactions/${transactionId}/attachments`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    
    setIsSaving(true);

    try {
      const url = editingId ? `/api/transactions/${editingId}` : "/api/transactions";
      const method = editingId ? "PUT" : "POST";

      const payload = {
        date: form.date,
        type: form.type,
        amount: parseFloat(parseCurrencyToNumber(form.amount)),
        home_id: parseInt(form.home_id),
        category_id: parseInt(form.category_id),
        employee_id: form.employee_id ? parseInt(form.employee_id) : null,
        company_id: form.company_id ? parseInt(form.company_id) : null,
        payment_method: form.payment_method,
        status: form.status,
        description: form.description || null,
        notes: form.notes || null,
        due_date: form.due_date || null,
        payment_date: form.payment_date || null,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        const transactionId = editingId || data.id;
        
        // Upload pending files
        if (pendingFiles.length > 0) {
          setIsUploadingFiles(true);
          await uploadFiles(transactionId);
          setIsUploadingFiles(false);
        }
        
        setIsOpen(false);
        setForm(emptyForm);
        setEditingId(null);
        setErrors({});
        setPendingFiles([]);
        setExistingAttachments([]);
        fetchData();
        toast({ title: editingId ? "Lançamento atualizado" : "Lançamento registrado" });
      } else {
        const error = await res.json();
        toast({ title: error.error || "Erro ao salvar", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error saving transaction:", error);
      toast({ title: "Erro ao salvar lançamento", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const fetchAttachments = async (transactionId: number) => {
    try {
      const res = await fetch(`/api/transactions/${transactionId}/attachments`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setExistingAttachments(data);
      }
    } catch (error) {
      console.error("Error fetching attachments:", error);
    }
  };

  const handleEdit = async (t: Transaction) => {
    setForm({
      date: t.date,
      type: t.type,
      amount: formatInputCurrency((t.amount * 100).toFixed(0)),
      home_id: t.home_id.toString(),
      category_id: t.category_id.toString(),
      employee_id: t.employee_id?.toString() || "",
      company_id: t.company_id?.toString() || "",
      payment_method: t.payment_method,
      status: t.status,
      description: t.description || "",
      notes: t.notes || "",
      due_date: t.due_date || "",
      payment_date: t.payment_date || "",
    });
    setEditingId(t.id);
    setPendingFiles([]);
    await fetchAttachments(t.id);
    setIsOpen(true);
  };

  const handleDuplicate = (t: Transaction) => {
    setForm({
      date: new Date().toISOString().split("T")[0],
      type: t.type,
      amount: formatInputCurrency((t.amount * 100).toFixed(0)),
      home_id: t.home_id.toString(),
      category_id: t.category_id.toString(),
      employee_id: t.employee_id?.toString() || "",
      company_id: t.company_id?.toString() || "",
      payment_method: t.payment_method,
      status: "PENDING",
      description: t.description || "",
      notes: t.notes || "",
      due_date: t.due_date || "",
      payment_date: "",
    });
    setEditingId(null);
    setIsOpen(true);
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: "Excluir lançamento?",
      message: "Esta ação não pode ser desfeita.",
      confirmText: "Excluir",
      cancelText: "Cancelar",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        fetchData();
        toast({ title: "Lançamento excluído" });
      }
    } catch (error) {
      console.error("Error deleting transaction:", error);
    }
  };

  const handleOpenNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setErrors({});
    setPendingFiles([]);
    setExistingAttachments([]);
    setIsOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setPendingFiles([...pendingFiles, ...Array.from(files)]);
    }
    e.target.value = "";
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setPendingFiles([...pendingFiles, ...Array.from(files)]);
    }
    e.target.value = "";
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(pendingFiles.filter((_, i) => i !== index));
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    const ok = await confirm({
      title: "Excluir anexo?",
      message: "Esta ação não pode ser desfeita.",
      confirmText: "Excluir",
      cancelText: "Cancelar",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/attachments/${attachmentId}`, { 
        method: "DELETE", 
        credentials: "include" 
      });
      if (res.ok) {
        setExistingAttachments(existingAttachments.filter(a => a.id !== attachmentId));
        toast({ title: "Anexo excluído" });
      }
    } catch (error) {
      console.error("Error deleting attachment:", error);
    }
  };

  const viewAttachment = async (attachment: Attachment) => {
    window.open(`/api/attachments/${attachment.id}/download`, "_blank");
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith("image/")) return ImageIcon;
    return FileText;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR");
  };

  // Apply filters
  const filteredTransactions = transactions.filter((t) => {
    if (filterDateStart && t.date < filterDateStart) return false;
    if (filterDateEnd && t.date > filterDateEnd) return false;
    if (filterDueDateStart && (!t.due_date || t.due_date < filterDueDateStart)) return false;
    if (filterDueDateEnd && (!t.due_date || t.due_date > filterDueDateEnd)) return false;
    if (filterType && t.type !== filterType) return false;
    if (filterCategoryId && t.category_id.toString() !== filterCategoryId) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPaymentMethod && t.payment_method !== filterPaymentMethod) return false;
    return true;
  });

  const totalReceitas = filteredTransactions
    .filter((t) => t.type === "REVENUE" && t.status !== "CANCELED")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalDespesas = filteredTransactions
    .filter((t) => t.type === "EXPENSE" && t.status !== "CANCELED")
    .reduce((sum, t) => sum + t.amount, 0);

  const saldo = totalReceitas - totalDespesas;

  const clearFilters = () => {
    setFilterDateStart("");
    setFilterDateEnd("");
    setFilterDueDateStart("");
    setFilterDueDateEnd("");
    setFilterType("");
    setFilterCategoryId("");
    setFilterStatus("");
    setFilterPaymentMethod("");
  };

  const hasActiveFilters = filterDateStart || filterDateEnd || filterDueDateStart || filterDueDateEnd || filterType || filterCategoryId || filterStatus || filterPaymentMethod;

  const handleExportExcel = () => {
    const headers = ["Data", "Vencimento", "Pagamento", "Tipo", "Categoria", "Centro de Custo", "Funcionário", "Empresa", "Valor", "Status", "Forma Pagamento", "Descrição"];
    const rows = filteredTransactions.map((t) => [
      t.date,
      t.due_date || "",
      t.payment_date || "",
      t.type === "REVENUE" ? "Receita" : "Despesa",
      t.category_name || "",
      t.home_name || "",
      t.employee_name || "",
      t.company_name || "",
      t.amount,
      t.status === "PAID" ? "Pago" : t.status === "PENDING" ? "Pendente" : "Cancelado",
      paymentMethodLabels[t.payment_method] || t.payment_method,
      t.description || ""
    ]);
    
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="UTF-8"></head>
      <body>
      <table border="1">
        <thead><tr>${headers.map(h => `<th style="background:#333;color:#fff;font-weight:bold;">${h}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows.map((row) => `<tr>${row.map((cell, i) => 
            i === 8 ? `<td style="text-align:right;">${Number(cell).toFixed(2).replace('.', ',')}</td>` : 
            `<td>${String(cell).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`
          ).join("")}</tr>`).join("")}
        </tbody>
      </table>
      </body></html>
    `;
    
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `registros_${new Date().toISOString().split("T")[0]}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const headers = ["Data", "Vencimento", "Pagamento", "Tipo", "Categoria", "Centro de Custo", "Funcionário", "Empresa", "Valor", "Status", "Forma Pagamento", "Descrição"];
    const rows = filteredTransactions.map((t) => [
      t.date,
      t.due_date || "",
      t.payment_date || "",
      t.type === "REVENUE" ? "Receita" : "Despesa",
      t.category_name || "",
      t.home_name || "",
      t.employee_name || "",
      t.company_name || "",
      t.amount,
      t.status === "PAID" ? "Pago" : t.status === "PENDING" ? "Pendente" : "Cancelado",
      paymentMethodLabels[t.payment_method] || t.payment_method,
      t.description || ""
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `registros_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Organize categories hierarchically
  const filteredCategories = (() => {
    const typeFiltered = categories.filter((c) => c.kind === form.type);
    const parents = typeFiltered.filter(c => !c.parent_id);
    const children: Record<number, Category[]> = {};
    
    typeFiltered.forEach(c => {
      if (c.parent_id) {
        if (!children[c.parent_id]) children[c.parent_id] = [];
        children[c.parent_id].push(c);
      }
    });

    // Build flat list with hierarchy preserved
    const list: (Category & { isChild?: boolean })[] = [];
    parents.forEach(parent => {
      list.push(parent);
      if (children[parent.id]) {
        children[parent.id].forEach(child => {
          list.push({ ...child, isChild: true });
        });
      }
    });

    return list;
  })();
  // Show active employees + the currently selected one (even if inactive)
  const employeesForSelect = employees.filter((e) => 
    e.is_active || (form.employee_id && e.id.toString() === form.employee_id)
  );
  // Show active companies + the currently selected one (even if inactive)
  const companiesForSelect = companies.filter((c) =>
    c.is_active || (form.company_id && c.id.toString() === form.company_id)
  );
  
  // All categories organized hierarchically for filters
  const allCategoriesHierarchical = (() => {
    const parents = categories.filter(c => !c.parent_id);
    const children: Record<number, Category[]> = {};
    
    categories.forEach(c => {
      if (c.parent_id) {
        if (!children[c.parent_id]) children[c.parent_id] = [];
        children[c.parent_id].push(c);
      }
    });

    const list: (Category & { isChild?: boolean })[] = [];
    parents.forEach(parent => {
      list.push(parent);
      if (children[parent.id]) {
        children[parent.id].forEach(child => {
          list.push({ ...child, isChild: true });
        });
      }
    });

    return list;
  })();

  const paymentMethodLabels: Record<string, string> = {
    CASH: "Dinheiro",
    PIX: "Pix",
    CARD: "Cartão",
    BOLETO: "Boleto",
    BOLETO_DDA: "Boleto (DDA)",
    TRANSFER: "Transferência",
  };

  const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
    PENDING: { label: "Pendente", variant: "secondary" },
    PAID: { label: "Pago", variant: "default" },
    CANCELED: { label: "Cancelado", variant: "destructive" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="w-7 h-7 text-primary" />
            Registros
          </h1>
          <p className="text-muted-foreground mt-1">
            Lançamentos financeiros
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="gap-2">
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filtros</span>
            {hasActiveFilters && <Badge variant="secondary" className="ml-1">{[filterDateStart, filterDateEnd, filterDueDateStart, filterDueDateEnd, filterType, filterCategoryId, filterStatus, filterPaymentMethod].filter(Boolean).length}</Badge>}
          </Button>
          <Button variant="outline" onClick={handleExportExcel} className="gap-2" disabled={filteredTransactions.length === 0}>
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">Excel</span>
          </Button>
          <Button variant="outline" onClick={handleExportCSV} className="gap-2" disabled={filteredTransactions.length === 0}>
            <FileDown className="w-4 h-4" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
          <Button onClick={handleOpenNew} className="gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo Lançamento</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      </div>

      {/* Filters Section */}
      {showFilters && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={filterDateStart}
                  onChange={(e) => setFilterDateStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={filterDateEnd}
                  onChange={(e) => setFilterDateEnd(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Vencimento Início</Label>
                <Input
                  type="date"
                  value={filterDueDateStart}
                  onChange={(e) => setFilterDueDateStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Vencimento Fim</Label>
                <Input
                  type="date"
                  value={filterDueDateEnd}
                  onChange={(e) => setFilterDueDateEnd(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={filterType} onValueChange={(v) => setFilterType(v === "all" ? "" : v as "" | "REVENUE" | "EXPENSE")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="EXPENSE">Despesa</SelectItem>
                    <SelectItem value="REVENUE">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={filterCategoryId} onValueChange={(v) => setFilterCategoryId(v === "all" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {allCategoriesHierarchical.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {(c as any).isChild ? `↳ ${c.name}` : c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v === "all" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="PENDING">Pendente</SelectItem>
                    <SelectItem value="PAID">Pago</SelectItem>
                    <SelectItem value="CANCELED">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select value={filterPaymentMethod} onValueChange={(v) => setFilterPaymentMethod(v === "all" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="CASH">Dinheiro</SelectItem>
                    <SelectItem value="PIX">Pix</SelectItem>
                    <SelectItem value="CARD">Cartão</SelectItem>
                    <SelectItem value="BOLETO">Boleto</SelectItem>
                    <SelectItem value="BOLETO_DDA">Boleto (DDA)</SelectItem>
                    <SelectItem value="TRANSFER">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {hasActiveFilters && (
              <div className="flex justify-end mt-4">
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Limpar Filtros
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Lançamento" : "Novo Lançamento"}</DialogTitle>
            <DialogDescription>
              Registre uma receita ou despesa
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Data Lançamento *</Label>
                <Input
                  id="date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Data de Vencimento</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_date">Data de Pagamento</Label>
                <Input
                  id="payment_date"
                  type="date"
                  value={form.payment_date}
                  onChange={(e) => {
                    const newPaymentDate = e.target.value;
                    setForm({ 
                      ...form, 
                      payment_date: newPaymentDate,
                      ...(newPaymentDate ? { status: "PAID" } : {})
                    });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Tipo *</Label>
                <Select
                  value={form.type}
                  onValueChange={(v: "REVENUE" | "EXPENSE") => setForm({ ...form, type: v, category_id: "" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXPENSE">
                      <span className="flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-red-500" />
                        Despesa
                      </span>
                    </SelectItem>
                    <SelectItem value="REVENUE">
                      <span className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        Receita
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Valor (R$) *</Label>
                <Input
                  id="amount"
                  type="text"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={form.amount}
                  onChange={(e) => {
                    const formatted = formatInputCurrency(e.target.value);
                    setForm({ ...form, amount: formatted });
                    if (errors.amount) setErrors({ ...errors, amount: "" });
                  }}
                  className={errors.amount ? "border-destructive" : ""}
                  required
                />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="home">Centro de Custo *</Label>
                <Select 
                  value={form.home_id} 
                  onValueChange={(v) => {
                    setForm({ ...form, home_id: v });
                    if (errors.home_id) setErrors({ ...errors, home_id: "" });
                  }}
                >
                  <SelectTrigger className={errors.home_id ? "border-destructive" : ""}>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {homes.map((h) => (
                      <SelectItem key={h.id} value={h.id.toString()}>
                        {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.home_id && <p className="text-xs text-destructive">{errors.home_id}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoria *</Label>
                <div className="relative" ref={categoryDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                    className={`w-full flex items-center justify-between border rounded-md px-3 py-2 text-sm ${
                      errors.category_id ? "border-destructive" : ""
                    }`}
                  >
                    <span>
                      {form.category_id 
                        ? (() => {
                            const selectedCat = filteredCategories.find(c => c.id.toString() === form.category_id);
                            if (!selectedCat) return "Selecione uma categoria";
                            if ((selectedCat as any).isChild) {
                              const parent = filteredCategories.find(c => c.id === selectedCat.parent_id);
                              return `${parent?.name} → ${selectedCat.name}`;
                            }
                            return selectedCat.name;
                          })()
                        : "Selecione uma categoria"
                      }
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${isCategoryDropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                  
                  {isCategoryDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                      {(() => {
                        // Group by parent
                        const parents = filteredCategories.filter(c => !c.parent_id);
                        const childrenMap: Record<number, Category[]> = {};
                        filteredCategories.forEach(c => {
                          if (c.parent_id) {
                            if (!childrenMap[c.parent_id]) childrenMap[c.parent_id] = [];
                            childrenMap[c.parent_id].push(c);
                          }
                        });

                        return parents.map(parent => {
                          const children = childrenMap[parent.id] || [];
                          const isExpanded = expandedCategories.has(parent.id);
                          const hasChildren = children.length > 0;
                          
                          return (
                            <div key={parent.id} className="border-b last:border-b-0">
                              <button
                                type="button"
                                onClick={() => {
                                  if (hasChildren) {
                                    const newExpanded = new Set(expandedCategories);
                                    if (isExpanded) {
                                      newExpanded.delete(parent.id);
                                    } else {
                                      newExpanded.add(parent.id);
                                    }
                                    setExpandedCategories(newExpanded);
                                  } else {
                                    setForm({ ...form, category_id: parent.id.toString() });
                                    if (errors.category_id) setErrors({ ...errors, category_id: "" });
                                    setIsCategoryDropdownOpen(false);
                                  }
                                }}
                                className={`w-full flex items-center justify-between p-2 hover:bg-muted/50 text-sm font-medium ${
                                  !hasChildren && form.category_id === parent.id.toString()
                                    ? "bg-primary text-primary-foreground"
                                    : ""
                                }`}
                              >
                                <span>{parent.name}</span>
                                {hasChildren && (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                              </button>
                              {isExpanded && children.length > 0 && (
                                <div className="bg-muted/20">
                                  {children.map(child => (
                                    <button
                                      key={child.id}
                                      type="button"
                                      onClick={() => {
                                        setForm({ ...form, category_id: child.id.toString() });
                                        if (errors.category_id) setErrors({ ...errors, category_id: "" });
                                        setIsCategoryDropdownOpen(false);
                                      }}
                                      className={`w-full text-left px-4 py-2 text-sm hover:bg-primary/10 ${
                                        form.category_id === child.id.toString() 
                                          ? "bg-primary text-primary-foreground font-semibold" 
                                          : ""
                                      }`}
                                    >
                                      ↳ {child.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
                {errors.category_id && <p className="text-xs text-destructive">{errors.category_id}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee">Funcionário</Label>
                <Select value={form.employee_id || "none"} onValueChange={(v) => setForm({ ...form, employee_id: v === "none" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {employeesForSelect.map((e) => (
                      <SelectItem key={e.id} value={e.id.toString()}>
                        {e.name}{!e.is_active ? " (inativo)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Empresa</Label>
                <Select value={form.company_id || "none"} onValueChange={(v) => setForm({ ...form, company_id: v === "none" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {companiesForSelect.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.name}{!c.is_active ? " (inativa)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment">Forma de Pagamento *</Label>
                <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Dinheiro</SelectItem>
                    <SelectItem value="PIX">Pix</SelectItem>
                    <SelectItem value="CARD">Cartão</SelectItem>
                    <SelectItem value="BOLETO">Boleto</SelectItem>
                    <SelectItem value="BOLETO_DDA">Boleto (DDA)</SelectItem>
                    <SelectItem value="TRANSFER">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pendente</SelectItem>
                    <SelectItem value="PAID">Pago</SelectItem>
                    <SelectItem value="CANCELED">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                placeholder="Breve descrição do lançamento"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Anotações adicionais"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            {/* Attachments Section */}
            <div className="space-y-3 pt-2 border-t">
              <Label>Anexos</Label>
              <div className="flex gap-2">
                <label className="flex-1">
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button type="button" variant="outline" className="w-full gap-2" asChild>
                    <span>
                      <Paperclip className="w-4 h-4" />
                      Adicionar Arquivo
                    </span>
                  </Button>
                </label>
                <label>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleCameraCapture}
                    className="hidden"
                  />
                  <Button type="button" variant="outline" className="gap-2" asChild>
                    <span>
                      <Camera className="w-4 h-4" />
                      Câmera
                    </span>
                  </Button>
                </label>
              </div>

              {/* Existing Attachments (when editing) */}
              {existingAttachments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Anexos existentes:</p>
                  {existingAttachments.map((attachment) => {
                    const FileIcon = getFileIcon(attachment.content_type);
                    return (
                      <div key={attachment.id} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                        <FileIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="flex-1 text-sm truncate">{attachment.original_name}</span>
                        <span className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => viewAttachment(attachment)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDeleteAttachment(attachment.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pending Files (new uploads) */}
              {pendingFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Novos arquivos:</p>
                  {pendingFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-primary/5 border border-primary/20 rounded-lg">
                      {file.type.startsWith("image/") ? (
                        <ImageIcon className="w-4 h-4 text-primary flex-shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                      )}
                      <span className="flex-1 text-sm truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removePendingFile(index)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving || isUploadingFiles}>
                {(isSaving || isUploadingFiles) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isUploadingFiles ? "Enviando arquivos..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between p-2 sm:p-4 pb-1 sm:pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Receitas</CardTitle>
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" />
          </CardHeader>
          <CardContent className="p-2 sm:p-4 pt-0 sm:pt-0">
            <p className="text-sm sm:text-lg font-bold text-green-600">{formatCurrency(totalReceitas)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <CardHeader className="flex flex-row items-center justify-between p-2 sm:p-4 pb-1 sm:pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Despesas</CardTitle>
            <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600" />
          </CardHeader>
          <CardContent className="p-2 sm:p-4 pt-0 sm:pt-0">
            <p className="text-sm sm:text-lg font-bold text-red-600">{formatCurrency(totalDespesas)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between p-2 sm:p-4 pb-1 sm:pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Saldo</CardTitle>
            <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
          </CardHeader>
          <CardContent className="p-2 sm:p-4 pt-0 sm:pt-0">
            <p className={`text-sm sm:text-lg font-bold ${saldo >= 0 ? "text-primary" : "text-red-600"}`}>
              {formatCurrency(saldo)}
            </p>
          </CardContent>
        </Card>
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
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Centro de Custo</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-[120px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          {hasActiveFilters ? "Nenhum lançamento encontrado com os filtros aplicados." : "Nenhum lançamento registrado. Clique em \"Novo Lançamento\" para começar."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTransactions.map((t) => (
                        <TableRow key={t.id} className={t.status === "CANCELED" ? "opacity-50" : ""}>
                          <TableCell>{formatDate(t.date)}</TableCell>
                          <TableCell>
                            {t.due_date ? (
                              <span className={`flex items-center gap-1 ${
                                t.status === "PENDING" && new Date(t.due_date) < new Date() 
                                  ? "text-red-500 font-medium" 
                                  : ""
                              }`}>
                                {t.status === "PENDING" && new Date(t.due_date) < new Date() && (
                                  <AlertCircle className="w-3.5 h-3.5" />
                                )}
                                {formatDate(t.due_date)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {t.type === "REVENUE" ? (
                              <TrendingUp className="w-4 h-4 text-green-500" />
                            ) : (
                              <TrendingDown className="w-4 h-4 text-red-500" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate">
                            <span className="flex items-center gap-1.5">
                              {t.description || t.category_name || "-"}
                              {t.attachment_count > 0 && (
                                <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                              )}
                            </span>
                          </TableCell>
                          <TableCell>{t.home_name}</TableCell>
                          <TableCell>{t.category_name}</TableCell>
                          <TableCell>{paymentMethodLabels[t.payment_method] || t.payment_method}</TableCell>
                          <TableCell>
                            <Badge variant={statusLabels[t.status]?.variant || "secondary"}>
                              {statusLabels[t.status]?.label || t.status}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${t.type === "REVENUE" ? "text-green-600" : "text-red-600"}`}>
                            {t.type === "REVENUE" ? "+" : "-"} {formatCurrency(t.amount)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => handleEdit(t)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Duplicar" onClick={() => handleDuplicate(t)}>
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Excluir" onClick={() => handleDelete(t.id)}>
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
              <div className="lg:hidden divide-y">
                {filteredTransactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {hasActiveFilters ? "Nenhum lançamento encontrado com os filtros aplicados." : "Nenhum lançamento registrado"}
                  </div>
                ) : (
                  filteredTransactions.map((t) => (
                    <div key={t.id} className={`p-4 space-y-3 ${t.status === "CANCELED" ? "opacity-50" : ""}`}>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {t.type === "REVENUE" ? (
                              <TrendingUp className="w-4 h-4 text-green-500" />
                            ) : (
                              <TrendingDown className="w-4 h-4 text-red-500" />
                            )}
                            <span className="font-medium flex items-center gap-1.5">
                              {t.description || t.category_name}
                              {t.attachment_count > 0 && (
                                <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                              )}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{t.home_name} • {t.category_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(t.date)}
                            {t.due_date && (
                              <span className={`ml-2 ${
                                t.status === "PENDING" && new Date(t.due_date) < new Date()
                                  ? "text-red-500"
                                  : ""
                              }`}>
                                • Venc: {formatDate(t.due_date)}
                                {t.status === "PENDING" && new Date(t.due_date) < new Date() && " (Atrasado)"}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${t.type === "REVENUE" ? "text-green-600" : "text-red-600"}`}>
                            {t.type === "REVENUE" ? "+" : "-"} {formatCurrency(t.amount)}
                          </p>
                          <Badge variant={statusLabels[t.status]?.variant || "secondary"} className="mt-1">
                            {statusLabels[t.status]?.label || t.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2 border-t">
                        <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => handleEdit(t)}>
                          <Pencil className="w-3 h-3" /> Editar
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => handleDuplicate(t)}>
                          <Copy className="w-3 h-3" /> Duplicar
                        </Button>
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
