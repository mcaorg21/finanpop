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
import { BarChart3, TrendingUp, TrendingDown, Wallet, FileDown, Filter, Receipt, Loader2, FileSpreadsheet, FileText, ChevronDown, ChevronUp, X } from "lucide-react";
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
  }>;
  byCategory: Array<{
    name: string;
    value: number;
  }>;
}

const CHART_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6366f1", "#06b6d4"
];

export default function RelatoriosPage() {
  const { error: showError } = useAlert();
  const [dueDateStart, setDueDateStart] = useState<string>(
    (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 3);
      return date.toISOString().split("T")[0];
    })()
  );
  const [dueDateEnd, setDueDateEnd] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
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

  const fetchReport = async () => {
    setIsFiltering(true);
    try {
      const params = new URLSearchParams();
      if (dueDateStart) params.append("due_date_start", dueDateStart);
      if (dueDateEnd) params.append("due_date_end", dueDateEnd);
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

      const res = await fetch(`/api/reports?${params.toString()}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
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

  const handleApplyFilters = () => {
    fetchReport();
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
    receitas: item.receitas,
    despesas: item.despesas,
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
    if (dueDateStart) params.append("due_date_start", dueDateStart);
    if (dueDateEnd) params.append("due_date_end", dueDateEnd);
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
    if (dueDateStart) params.append("due_date_start", dueDateStart);
    if (dueDateEnd) params.append("due_date_end", dueDateEnd);
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
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary" />
            Relatórios
          </h1>
          <p className="text-muted-foreground mt-1">
            Análise financeira com filtros
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportPDF} className="gap-2" disabled={isExportingPdf}>
            {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            <span className="hidden sm:inline">PDF</span>
          </Button>
          <Button variant="outline" onClick={handleExportExcel} className="gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">Excel</span>
          </Button>
          <Button variant="outline" onClick={handleExportCSV} className="gap-2">
            <FileDown className="w-4 h-4" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              className="lg:hidden"
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
          {/* Mobile: Due date filters always visible */}
          <div className="grid grid-cols-2 gap-2 mt-3 lg:hidden">
            <div className="space-y-1">
              <Label className="text-xs">Vencimento Início</Label>
              <Input
                type="date"
                value={dueDateStart}
                onChange={(e) => setDueDateStart(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vencimento Fim</Label>
              <Input
                type="date"
                value={dueDateEnd}
                onChange={(e) => setDueDateEnd(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Desktop: Full grid */}
          <div className="hidden lg:grid lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Vencimento Início</Label>
              <Input
                type="date"
                value={dueDateStart}
                onChange={(e) => setDueDateStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Vencimento Fim</Label>
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
                {isFiltering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
                Aplicar
              </Button>
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
              {isFiltering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
              Aplicar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Content - for PDF export */}
      <div ref={reportContentRef} className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receitas</CardTitle>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <p className="text-xl lg:text-2xl font-bold text-green-600">
              {formatCurrency(reportData?.totals.receitas || 0)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despesas</CardTitle>
            <TrendingDown className="w-5 h-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <p className="text-xl lg:text-2xl font-bold text-red-600">
              {formatCurrency(reportData?.totals.despesas || 0)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo</CardTitle>
            <Wallet className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className={`text-xl lg:text-2xl font-bold ${(reportData?.totals.saldo || 0) >= 0 ? "text-primary" : "text-red-600"}`}>
              {formatCurrency(reportData?.totals.saldo || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lançamentos</CardTitle>
            <Receipt className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xl lg:text-2xl font-bold">{reportData?.totals.lancamentos || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolution Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evolução de receitas e despesas</CardTitle>
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
                      formatter={(value) => formatCurrency(Number(value))}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="receitas"
                      stroke="#22c55e"
                      fill="#22c55e"
                      fillOpacity={0.2}
                      strokeWidth={2}
                      name="Receitas"
                    />
                    <Area
                      type="monotone"
                      dataKey="despesas"
                      stroke="#ef4444"
                      fill="#ef4444"
                      fillOpacity={0.2}
                      strokeWidth={2}
                      name="Despesas"
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
          <CardHeader>
            <CardTitle className="text-lg">Distribuição por Categoria</CardTitle>
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
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
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

      
    </div>
  );
}
