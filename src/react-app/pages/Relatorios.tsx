import { useState, useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/react-app/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/react-app/components/ui/popover";
import { Checkbox } from "@/react-app/components/ui/checkbox";
import { Loader2, ChevronDown, ChevronUp, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/react-app/components/ui/table";
import { Badge } from "@/react-app/components/ui/badge";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useAlert } from "@/react-app/hooks/use-alert";

interface Home {
  id: number;
  name: string;
}

interface Employee {
  id: number;
  name: string;
}

interface Category {
  id: number;
  name: string;
  kind: string;
  parent_id: number | null;
}

interface Company {
  id: number;
  name: string;
}

interface Transaction {
  id: number;
  date: string;
  due_date: string | null;
  payment_date: string | null;
  type: "REVENUE" | "EXPENSE";
  category_id: number | null;
  category_name: string | null;
  home_name: string | null;
  employee_name: string | null;
  company_name: string | null;
  amount: number;
  status: "PAID" | "PENDING" | "CANCELED";
  payment_method: string | null;
  description: string | null;
}

interface ReportData {
  totals: {
    receitas: number;
    despesas: number;
    saldo: number;
    lancamentos: number;
  };
  evolution: Array<{
    date: string;
    receitas: number;
    despesas: number;
    despesas_pagas: number;
    despesas_pendentes: number;
  }>;
  byCategory: Array<{
    category_id: number;
    name: string;
    value: number;
  }>;
}

// Manter em sincronia com --chart-* do index.css (hex literais: html2canvas não resolve var() em SVG)
const CHART_COLORS = [
  "#526B94", "#478566", "#B85C63", "#A3853F", "#8A7BA8",
  "#49818F", "#AD6E52", "#5C7A46", "#A6708F", "#83888F"
];

type DateField = "date" | "due_date" | "payment_date";

const DATE_FIELD_KEY = "finanpop_report_date_field";

const lastDayOfCurrentMonth = (): string => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
};

const threeMonthsAgo = (): string => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 2);
  return d.toISOString().split("T")[0];
};

export default function RelatoriosPage() {
  const { error: showError } = useAlert();

  const [dateField, setDateField] = useState<DateField>(() => {
    const saved = localStorage.getItem(DATE_FIELD_KEY) as DateField | null;
    return saved && ["date", "due_date", "payment_date"].includes(saved) ? saved : "due_date";
  });
  const [dueDateStart, setDueDateStart] = useState<string>(threeMonthsAgo());
  const [dueDateEnd, setDueDateEnd] = useState<string>(lastDayOfCurrentMonth());
  const [homeIds, setHomeIds] = useState<string[]>([]);
  const [employeeId, setEmployeeId] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [type, setType] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const [homes, setHomes] = useState<Home[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedPieCategoryId, setSelectedPieCategoryId] = useState<number | null>(null);
  const reportContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [homesRes, employeesRes, companiesRes, categoriesRes] = await Promise.all([
          fetch("/api/homes", { credentials: "include" }),
          fetch("/api/employees", { credentials: "include" }),
          fetch("/api/companies", { credentials: "include" }),
          fetch("/api/categories", { credentials: "include" }),
        ]);
        
        if (homesRes.ok) setHomes(await homesRes.json());
        if (employeesRes.ok) setEmployees(await employeesRes.json());
        if (companiesRes.ok) setCompanies(await companiesRes.json());
        if (categoriesRes.ok) setCategories(await categoriesRes.json());
      } catch (error) {
        console.error("Error fetching options:", error);
      }
    };
    fetchOptions();
  }, []);

  const appendDateParams = (params: URLSearchParams) => {
    const startKey = dateField === "date" ? "start_date" : dateField === "due_date" ? "due_date_start" : "payment_date_start";
    const endKey = dateField === "date" ? "end_date" : dateField === "due_date" ? "due_date_end" : "payment_date_end";
    if (dueDateStart) params.append(startKey, dueDateStart);
    if (dueDateEnd) params.append(endKey, dueDateEnd);
  };

  const fetchReport = async () => {
    setIsFiltering(true);
    try {
      const params = new URLSearchParams();
      appendDateParams(params);
      if (homeIds.length > 0) {
        homeIds.forEach(id => params.append("home_ids[]", id));
      }
      if (employeeId && employeeId !== "all") params.append("employee_id", employeeId);
      if (companyId && companyId !== "all") params.append("company_id", companyId);
      if (categoryIds.length > 0) {
        categoryIds.forEach(id => params.append("category_ids[]", id));
      }
      if (type && type !== "all") params.append("type", type);
      if (status && status !== "all") params.append("status", status);

      const [reportRes, txRes] = await Promise.all([
        fetch(`/api/reports?${params.toString()}`, { credentials: "include" }),
        fetch(`/api/transactions?${params.toString()}`, { credentials: "include" }),
      ]);
      if (reportRes.ok) {
        const data = await reportRes.json();
        setReportData(data);
      }
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData);
      }
    } catch (error) {
      console.error("Error fetching report:", error);
    } finally {
      setIsFiltering(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handleDateFieldChange = (field: DateField) => {
    setDateField(field);
    localStorage.setItem(DATE_FIELD_KEY, field);
  };

  const dateFieldLabels: Record<DateField, string> = {
    date: "Cadastro",
    due_date: "Vencimento",
    payment_date: "Pagamento",
  };

  const handleApplyFilters = () => {
    setSelectedPieCategoryId(null);
    fetchReport();
  };

  const handlePieClick = (data: any) => {
    const id = data.category_id as number;
    setSelectedPieCategoryId(prev => prev === id ? null : id);
  };

  const filteredTransactions = selectedPieCategoryId != null
    ? transactions.filter(t => t.category_id === selectedPieCategoryId)
    : transactions;

  const selectedPieCategoryName = selectedPieCategoryId != null
    ? (reportData?.byCategory.find(c => c.category_id === selectedPieCategoryId)?.name ?? null)
    : null;

  const formatDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

  const formatPaymentMethod = (pm: string | null) => {
    const map: Record<string, string> = {
      CASH: "Dinheiro", PIX: "Pix", CARD: "Cartão",
      BOLETO: "Boleto", BOLETO_DDA: "Boleto DDA",
      TRANSFER: "Transferência", PIX_PARCELADO: "Pix Parc.",
    };
    return pm ? (map[pm] || pm) : "—";
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDateLabel = (dateStr: string) => {
    // Handle month format (YYYY-MM)
    if (dateStr.length === 7 && dateStr.includes('-')) {
      const [year, month] = dateStr.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
    }
    // Handle full date format
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  // Prepare evolution data (non-cumulative)
  const evolutionData = (reportData?.evolution || []).map((item) => ({
    date: formatDateLabel(item.date),
    receitas: Number(item.receitas),
    despesas_pagas: Number(item.despesas_pagas),
    despesas_pendentes: Number(item.despesas_pendentes),
  }));

  // Prepare category data with colors
  const categoryData = (reportData?.byCategory || []).map((item, index) => ({
    ...item,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));


  // Organize categories hierarchically for selects
  const hierarchicalCategories = (() => {
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

  const handleExportPDF = async () => {
    if (!reportContentRef.current) return;
    
    setIsExportingPdf(true);
    try {
      const logoUrl = "/logo-secgo.png";
      
      // Capture the report content
      const canvas = await html2canvas(reportContentRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      let headerHeight = 10;
      
      // Try to add logo
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          logoImg.onload = () => resolve();
          logoImg.onerror = () => reject(new Error("Logo failed"));
          logoImg.src = logoUrl;
        });
        
        const logoWidth = 30;
        const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
        pdf.addImage(logoImg, "PNG", (pageWidth - logoWidth) / 2, 10, logoWidth, logoHeight);
        headerHeight = 10 + logoHeight;
      } catch {
        // Continue without logo
        headerHeight = 10;
      }
      
      // Add title and period
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text("Relatório Financeiro", pageWidth / 2, headerHeight + 10, { align: "center" });
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const periodText = `Período: ${new Date(dueDateStart + "T00:00:00").toLocaleDateString("pt-BR")} a ${new Date(dueDateEnd + "T00:00:00").toLocaleDateString("pt-BR")}`;
      pdf.text(periodText, pageWidth / 2, headerHeight + 18, { align: "center" });
      
      // Add captured content
      const contentTop = headerHeight + 25;
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height / canvas.width) * imgWidth;
      
      // Check if content fits in one page
      const availableHeight = pageHeight - contentTop - 10;
      if (imgHeight <= availableHeight) {
        pdf.addImage(imgData, "PNG", 10, contentTop, imgWidth, imgHeight);
      } else {
        // Scale down to fit
        const scale = availableHeight / imgHeight;
        pdf.addImage(imgData, "PNG", 10, contentTop, imgWidth * scale, availableHeight);
      }
      
      pdf.save(`relatorio_${dueDateStart}_${dueDateEnd}.pdf`);
    } catch (error) {
      console.error("Error exporting PDF:", error);
      showError("Erro ao exportar PDF. Tente novamente.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    const params = new URLSearchParams();
    appendDateParams(params);
    if (homeIds.length > 0) {
      homeIds.forEach(id => params.append("home_ids[]", id));
    }
    if (employeeId) params.append("employee_id", employeeId);
    if (companyId) params.append("company_id", companyId);
    if (categoryIds.length > 0) {
      categoryIds.forEach(id => params.append("category_ids[]", id));
    }
    if (type) params.append("type", type);
    if (status) params.append("status", status);

    try {
      const res = await fetch(`/api/transactions?${params.toString()}`, { credentials: "include" });
      if (res.ok) {
        const transactions = await res.json();
        
        // Create Excel-compatible HTML table
        const headers = ["Data", "Vencimento", "Pagamento", "Tipo", "Categoria", "Centro de Custo", "Funcionário", "Empresa", "Valor", "Status", "Forma Pagamento", "Descrição"];
        const rows = transactions.map((t: any) => [
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
          t.payment_method === "CASH" ? "Dinheiro" : 
          t.payment_method === "PIX" ? "Pix" : 
          t.payment_method === "CARD" ? "Cartão" : 
          t.payment_method === "BOLETO" ? "Boleto" : 
          t.payment_method === "BOLETO_DDA" ? "Boleto (DDA)" : 
          t.payment_method === "TRANSFER" ? "Transferência" : t.payment_method,
          t.description || ""
        ]);
        
        // Build HTML table for Excel
        let html = `
          <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
          <head><meta charset="UTF-8"></head>
          <body>
          <table border="1">
            <thead><tr>${headers.map(h => `<th style="background:#333;color:#fff;font-weight:bold;">${h}</th>`).join("")}</tr></thead>
            <tbody>
              ${rows.map((row: any[]) => `<tr>${row.map((cell, i) => 
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
        link.download = `relatorio_${dueDateStart}_${dueDateEnd}.xls`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Error exporting Excel:", error);
    }
  };

  const handleExportCSV = async () => {
    const params = new URLSearchParams();
    appendDateParams(params);
    if (homeIds.length > 0) {
      homeIds.forEach(id => params.append("home_ids[]", id));
    }
    if (employeeId) params.append("employee_id", employeeId);
    if (companyId) params.append("company_id", companyId);
    if (categoryIds.length > 0) {
      categoryIds.forEach(id => params.append("category_ids[]", id));
    }
    if (type) params.append("type", type);
    if (status) params.append("status", status);

    try {
      const res = await fetch(`/api/transactions?${params.toString()}`, { credentials: "include" });
      if (res.ok) {
        const transactions = await res.json();
        
        // Create CSV content
        const headers = ["Data", "Tipo", "Categoria", "Centro de Custo", "Funcionário", "Empresa", "Valor", "Status", "Forma Pagamento", "Descrição"];
        const rows = transactions.map((t: any) => [
          t.date,
          t.type === "REVENUE" ? "Receita" : "Despesa",
          t.category_name || "",
          t.home_name || "",
          t.employee_name || "",
          t.company_name || "",
          t.amount,
          t.status === "PAID" ? "Pago" : t.status === "PENDING" ? "Pendente" : "Cancelado",
          t.payment_method,
          t.description || ""
        ]);
        
        const csvContent = [headers, ...rows]
          .map(row => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
          .join("\n");
        
        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `relatorio_${dueDateStart}_${dueDateEnd}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Error exporting CSV:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Análise financeira com filtros
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportPDF} className="gap-2" disabled={isExportingPdf}>
            {isExportingPdf && <Loader2 className="w-4 h-4 animate-spin" />}
            PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel}>
            Excel
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Filtros</CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              className="lg:hidden"
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
          {/* Mobile: date field selector + dates always visible */}
          <div className="mt-3 space-y-2 lg:hidden">
            <div className="flex gap-1">
              {(["date", "due_date", "payment_date"] as DateField[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => handleDateFieldChange(f)}
                  className={`flex-1 py-1 text-xs rounded-md border transition-colors ${
                    dateField === f ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-muted"
                  }`}
                >
                  {dateFieldLabels[f]}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{dateFieldLabels[dateField]} Início</Label>
                <Input type="date" value={dueDateStart} onChange={(e) => setDueDateStart(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{dateFieldLabels[dateField]} Fim</Label>
                <Input type="date" value={dueDateEnd} onChange={(e) => setDueDateEnd(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Desktop: Full grid */}
          <div className="hidden lg:block space-y-4">
            {/* Date field selector */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Filtrar por data de:</span>
              <div className="flex gap-1">
                {(["date", "due_date", "payment_date"] as DateField[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => handleDateFieldChange(f)}
                    className={`px-4 py-1.5 text-sm rounded-md border transition-colors ${
                      dateField === f ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-muted"
                    }`}
                  >
                    {dateFieldLabels[f]}
                  </button>
                ))}
              </div>
            </div>

          <div className="lg:grid lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>{dateFieldLabels[dateField]} Início</Label>
              <Input
                type="date"
                value={dueDateStart}
                onChange={(e) => setDueDateStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{dateFieldLabels[dateField]} Fim</Label>
              <Input
                type="date"
                value={dueDateEnd}
                onChange={(e) => setDueDateEnd(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Centro de Custo</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    {homeIds.length === 0 ? "Todos" : `${homeIds.length} selecionado${homeIds.length > 1 ? 's' : ''}`}
                    <ChevronDown className="w-4 h-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="start">
                  <div className="max-h-[300px] overflow-y-auto p-3 space-y-2">
                    {homeIds.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-center gap-2 h-8 mb-2"
                        onClick={() => setHomeIds([])}
                      >
                        <X className="w-3 h-3" />
                        Limpar seleção
                      </Button>
                    )}
                    {homes.map((home) => (
                      <div key={home.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`home-${home.id}`}
                          checked={homeIds.includes(String(home.id))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setHomeIds([...homeIds, String(home.id)]);
                            } else {
                              setHomeIds(homeIds.filter(id => id !== String(home.id)));
                            }
                          }}
                        />
                        <label
                          htmlFor={`home-${home.id}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {home.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Funcionário</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {companies.map((comp) => (
                    <SelectItem key={comp.id} value={String(comp.id)}>{comp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categorias</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    {categoryIds.length === 0 ? "Todas" : `${categoryIds.length} selecionada${categoryIds.length > 1 ? 's' : ''}`}
                    <ChevronDown className="w-4 h-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="start">
                  <div className="max-h-[300px] overflow-y-auto p-3 space-y-2">
                    {categoryIds.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-center gap-2 h-8 mb-2"
                        onClick={() => setCategoryIds([])}
                      >
                        <X className="w-3 h-3" />
                        Limpar seleção
                      </Button>
                    )}
                    {hierarchicalCategories.map((cat) => (
                      <div key={cat.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`cat-${cat.id}`}
                          checked={categoryIds.includes(String(cat.id))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setCategoryIds([...categoryIds, String(cat.id)]);
                            } else {
                              setCategoryIds(categoryIds.filter(id => id !== String(cat.id)));
                            }
                          }}
                        />
                        <label
                          htmlFor={`cat-${cat.id}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {(cat as any).isChild ? `↳ ${cat.name}` : cat.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="REVENUE">Receita</SelectItem>
                  <SelectItem value="EXPENSE">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="PAID">Pago</SelectItem>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="CANCELED">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="w-full gap-2" onClick={handleApplyFilters} disabled={isFiltering}>
                {isFiltering && <Loader2 className="w-4 h-4 animate-spin" />}
                Aplicar
              </Button>
            </div>
          </div>
          </div>

          {/* Mobile: Collapsible extra filters */}
          {showFilters && (
            <div className="grid grid-cols-2 gap-2 mt-3 lg:hidden">
              <div className="space-y-1">
                <Label className="text-xs">Centro de Custo</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal h-9 text-sm">
                      {homeIds.length === 0 ? "Todos" : `${homeIds.length} selecionado${homeIds.length > 1 ? 's' : ''}`}
                      <ChevronDown className="w-4 h-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[240px] p-0" align="start">
                    <div className="max-h-[250px] overflow-y-auto p-2 space-y-1.5">
                      {homeIds.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-center gap-2 h-7 text-xs mb-1"
                          onClick={() => setHomeIds([])}
                        >
                          <X className="w-3 h-3" />
                          Limpar
                        </Button>
                      )}
                      {homes.map((home) => (
                        <div key={home.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`home-mobile-${home.id}`}
                            checked={homeIds.includes(String(home.id))}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setHomeIds([...homeIds, String(home.id)]);
                              } else {
                                setHomeIds(homeIds.filter(id => id !== String(home.id)));
                              }
                            }}
                          />
                          <label
                            htmlFor={`home-mobile-${home.id}`}
                            className="text-xs cursor-pointer flex-1"
                          >
                            {home.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Funcionário</Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>{emp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Empresa</Label>
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {companies.map((comp) => (
                      <SelectItem key={comp.id} value={String(comp.id)}>{comp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Categorias</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal h-9 text-sm">
                      {categoryIds.length === 0 ? "Todas" : `${categoryIds.length} selecionada${categoryIds.length > 1 ? 's' : ''}`}
                      <ChevronDown className="w-4 h-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[240px] p-0" align="start">
                    <div className="max-h-[250px] overflow-y-auto p-2 space-y-1.5">
                      {categoryIds.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-center gap-2 h-7 text-xs mb-1"
                          onClick={() => setCategoryIds([])}
                        >
                          <X className="w-3 h-3" />
                          Limpar
                        </Button>
                      )}
                      {hierarchicalCategories.map((cat) => (
                        <div key={cat.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`cat-mobile-${cat.id}`}
                            checked={categoryIds.includes(String(cat.id))}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setCategoryIds([...categoryIds, String(cat.id)]);
                              } else {
                                setCategoryIds(categoryIds.filter(id => id !== String(cat.id)));
                              }
                            }}
                          />
                          <label
                            htmlFor={`cat-mobile-${cat.id}`}
                            className="text-xs cursor-pointer flex-1"
                          >
                            {(cat as any).isChild ? `↳ ${cat.name}` : cat.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="REVENUE">Receita</SelectItem>
                    <SelectItem value="EXPENSE">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="PAID">Pago</SelectItem>
                    <SelectItem value="PENDING">Pendente</SelectItem>
                    <SelectItem value="CANCELED">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Mobile: Apply button */}
          <div className="mt-3 lg:hidden">
            <Button className="w-full gap-2 h-9" onClick={handleApplyFilters} disabled={isFiltering}>
              {isFiltering && <Loader2 className="w-4 h-4 animate-spin" />}
              Aplicar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Content - for PDF export */}
      <div ref={reportContentRef} className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card size="sm">
          <CardContent>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Receitas</p>
            <p className="mt-2 text-xl lg:text-2xl font-semibold tracking-tight tabular-nums text-success">
              {formatCurrency(reportData?.totals.receitas || 0)}
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Despesas</p>
            <p className="mt-2 text-xl lg:text-2xl font-semibold tracking-tight tabular-nums text-danger">
              {formatCurrency(reportData?.totals.despesas || 0)}
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Saldo</p>
            <p className={`mt-2 text-xl lg:text-2xl font-semibold tracking-tight tabular-nums ${(reportData?.totals.saldo || 0) >= 0 ? "text-success" : "text-danger"}`}>
              {formatCurrency(reportData?.totals.saldo || 0)}
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lançamentos</p>
            <p className="mt-2 text-xl lg:text-2xl font-semibold tracking-tight tabular-nums">{reportData?.totals.lancamentos || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolution Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Evolução de receitas e despesas</span>
              <div className="flex items-center gap-4 text-xs font-normal text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-[#478566]" />Receitas</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-[#B85C63]" />Desp. Pagas</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-[#A3853F]" />Desp. Pendentes</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {evolutionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={evolutionData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                    <Tooltip
                      formatter={(value, name) => [
                        formatCurrency(Number(value)),
                        name === "receitas" ? "Receitas" : name === "despesas_pagas" ? "Desp. Pagas" : "Desp. Pendentes",
                      ]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="receitas"
                      stroke="#478566"
                      fill="#478566"
                      fillOpacity={0.12}
                      strokeWidth={2}
                      name="receitas"
                    />
                    <Area
                      type="monotone"
                      dataKey="despesas_pagas"
                      stroke="#B85C63"
                      fill="#B85C63"
                      fillOpacity={0.15}
                      strokeWidth={2}
                      name="despesas_pagas"
                    />
                    <Area
                      type="monotone"
                      dataKey="despesas_pendentes"
                      stroke="#A3853F"
                      fill="#A3853F"
                      fillOpacity={0.1}
                      strokeWidth={2}
                      strokeDasharray="5 3"
                      name="despesas_pendentes"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Nenhum dado para exibir
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Distribuição por Categoria</span>
              {selectedPieCategoryName && (
                <button
                  onClick={() => setSelectedPieCategoryId(null)}
                  className="flex items-center gap-1 text-xs font-normal border rounded-md px-2 py-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="font-medium text-foreground">{selectedPieCategoryName}</span>
                  <X className="w-3 h-3" />
                </button>
              )}
            </CardTitle>
            {!selectedPieCategoryId && categoryData.length > 0 && (
              <p className="text-xs text-muted-foreground">Clique em uma fatia para filtrar os lançamentos</p>
            )}
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                      onClick={handlePieClick}
                      style={{ cursor: "pointer" }}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          opacity={selectedPieCategoryId != null && selectedPieCategoryId !== entry.category_id ? 0.3 : 1}
                          stroke={selectedPieCategoryId === entry.category_id ? "#fff" : "none"}
                          strokeWidth={selectedPieCategoryId === entry.category_id ? 2 : 0}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Nenhum dado para exibir
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>

      {/* Transaction Listing */}
      {transactions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                Lançamentos
                <span className="text-sm font-normal text-muted-foreground">
                  ({filteredTransactions.length}{selectedPieCategoryId != null ? ` de ${transactions.length}` : ""})
                </span>
              </span>
              {selectedPieCategoryName && (
                <button
                  onClick={() => setSelectedPieCategoryId(null)}
                  className="flex items-center gap-1.5 text-sm border rounded-md px-2 py-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Categoria: <span className="font-semibold text-foreground">{selectedPieCategoryName}</span>
                  <X className="w-3 h-3" />
                </button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cadastro</TableHead>
                    <TableHead>Venc.</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="hidden lg:table-cell">Empresa</TableHead>
                    <TableHead className="hidden lg:table-cell">Forma Pag.</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-muted-foreground">{formatDate(t.date)}</TableCell>
                      <TableCell className="text-muted-foreground">{t.due_date ? formatDate(t.due_date) : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={t.type === "REVENUE" ? "success" : "danger"}>
                          {t.type === "REVENUE" ? "Receita" : "Despesa"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[130px] truncate">{t.category_name || "—"}</TableCell>
                      <TableCell className="max-w-[160px] truncate">{t.description || "—"}</TableCell>
                      <TableCell className="max-w-[130px] truncate hidden lg:table-cell text-muted-foreground">{t.company_name || "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">{formatPaymentMethod(t.payment_method)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        <span className={t.type === "REVENUE" ? "text-success" : "text-danger"}>
                          {formatCurrency(t.amount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.status === "PAID" ? "success" : t.status === "PENDING" ? "outline" : "secondary"}>
                          {t.status === "PAID" ? "Pago" : t.status === "PENDING" ? "Pendente" : "Cancelado"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
