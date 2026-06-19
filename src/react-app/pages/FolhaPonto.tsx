import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/react-app/components/ui/card";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/react-app/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/react-app/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/react-app/components/ui/table";
import { Badge } from "@/react-app/components/ui/badge";
import { Clock, Plus, Pencil, Trash2, Loader2, FileText, Download, Lock, Unlock } from "lucide-react";
import { useToast } from "@/react-app/hooks/use-toast";
import { useAlert } from "@/react-app/hooks/use-alert";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface Employee {
  id: number;
  name: string;
  role: string;
  document: string;
  ctps_numero: string;
  ctps_serie: string;
  admission_date: string;
  work_schedule: string;
  saturday_schedule: string;
  weekly_rest: string;
  hours_per_day: string;
  is_active: number;
}

interface TimesheetEntry {
  id?: number;
  timesheet_id?: number;
  day: number;
  entry1: string;
  exit1: string;
  entry2: string;
  exit2: string;
  hours_worked: string;
  hours_expected: string;
  overtime: string;
  observation: string;
}

interface Timesheet {
  id: number;
  employee_id: number;
  month: number;
  year: number;
  status: string;
  total_worked: string;
  total_expected: string;
  total_overtime: string;
  notes: string;
  employee_name: string;
  employee_role: string;
  document?: string;
  ctps_numero?: string;
  ctps_serie?: string;
  admission_date?: string;
  work_schedule?: string;
  saturday_schedule?: string;
  weekly_rest?: string;
  hours_per_day?: string;
  entries?: TimesheetEntry[];
}

const MONTHS = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

const getDaysInMonth = (month: number, year: number) => {
  return new Date(year, month, 0).getDate();
};

const getDayOfWeek = (day: number, month: number, year: number) => {
  const date = new Date(year, month - 1, day);
  const days = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  return days[date.getDay()];
};

const isWeekend = (day: number, month: number, year: number) => {
  const date = new Date(year, month - 1, day);
  return date.getDay() === 0 || date.getDay() === 6;
};

const parseTime = (time: string): number => {
  if (!time) return 0;
  const parts = time.split(":");
  const hours = parseInt(parts[0]) || 0;
  const minutes = parseInt(parts[1]) || 0;
  const seconds = parseInt(parts[2]) || 0;
  return hours * 3600 + minutes * 60 + seconds;
};

const formatTimeFromSeconds = (totalSeconds: number): string => {
  const isNegative = totalSeconds < 0;
  totalSeconds = Math.abs(totalSeconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const formatted = `${hours.toString().padStart(1, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  return isNegative ? `-${formatted}` : formatted;
};

const calculateWorkedHours = (entry1: string, exit1: string, entry2: string, exit2: string): string => {
  let total = 0;
  if (entry1 && exit1) {
    total += parseTime(exit1) - parseTime(entry1);
  }
  if (entry2 && exit2) {
    total += parseTime(exit2) - parseTime(entry2);
  }
  return total > 0 ? formatTimeFromSeconds(total) : "0:00:00";
};

const calculateOvertime = (worked: string, expected: string): string => {
  const workedSeconds = parseTime(worked);
  const expectedSeconds = parseTime(expected);
  return formatTimeFromSeconds(workedSeconds - expectedSeconds);
};

// Helper to check if a time value is effectively zero (regardless of format)
const isZeroTime = (time: string | null | undefined): boolean => {
  if (!time) return true;
  return parseTime(time) === 0;
};

const sumTimes = (times: string[]): string => {
  let total = 0;
  for (const time of times) {
    if (time && time !== "0:00:00") {
      if (time.startsWith("-")) {
        total -= parseTime(time.substring(1));
      } else {
        total += parseTime(time);
      }
    }
  }
  return formatTimeFromSeconds(total);
};

export default function FolhaPontoPage() {
  const { toast } = useToast();
  const { confirm } = useAlert();
  const printRef = useRef<HTMLDivElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  // Filters
  const currentDate = new Date();
  const [filterMonth, setFilterMonth] = useState(currentDate.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(currentDate.getFullYear());
  const [filterEmployee, setFilterEmployee] = useState("");
  
  // Dialog states
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedTimesheet, setSelectedTimesheet] = useState<Timesheet | null>(null);
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  
  // New timesheet form
  const [newForm, setNewForm] = useState({
    employee_id: "",
    month: currentDate.getMonth() + 1,
    year: currentDate.getFullYear(),
  });

  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/employees", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.filter((e: Employee) => e.is_active !== 0));
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchTimesheets = async () => {
    try {
      const params = new URLSearchParams();
      if (filterMonth) params.append("month", filterMonth.toString());
      if (filterYear) params.append("year", filterYear.toString());
      if (filterEmployee) params.append("employee_id", filterEmployee);
      
      const res = await fetch(`/api/timesheets?${params}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setTimesheets(data);
      }
    } catch (error) {
      console.error("Error fetching timesheets:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchTimesheets();
  }, [filterMonth, filterYear, filterEmployee]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      const res = await fetch("/api/timesheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newForm),
        credentials: "include",
      });
      
      if (res.ok) {
        setIsNewOpen(false);
        setNewForm({
          employee_id: "",
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
        });
        fetchTimesheets();
        toast({ title: "Folha de ponto criada" });
      } else {
        const error = await res.json();
        toast({ title: error.error || "Erro ao criar folha", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error creating timesheet:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenDetail = async (timesheet: Timesheet) => {
    try {
      const res = await fetch(`/api/timesheets/${timesheet.id}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSelectedTimesheet(data);
        
        // Initialize entries for all days
        const daysInMonth = getDaysInMonth(data.month, data.year);
        const existingEntries = data.entries || [];
        const allEntries: TimesheetEntry[] = [];
        
        for (let day = 1; day <= daysInMonth; day++) {
          const existing = existingEntries.find((e: TimesheetEntry) => e.day === day);
          if (existing) {
            // Verificar se é dia de ausência (férias, feriado, atestado, etc.)
            const obs = (existing.observation || "").toLowerCase().trim();
            const isAbsence = obs.includes("férias") || obs.includes("ferias") || obs.includes("feriado") || 
                             obs.includes("atestado") || obs.includes("folga") || obs.includes("licença") ||
                             obs.includes("licenca") || obs.includes("afastamento") ||
                             obs.includes("sábado") || obs.includes("sabado") || obs.includes("domingo");
            
            // Garantir que hours_expected tenha valor válido
            if (isWeekend(day, data.month, data.year) || isAbsence) {
              existing.hours_expected = "0:00:00";
            } else if (isZeroTime(existing.hours_expected)) {
              // Dia útil ou sem observação deve ter horas previstas do funcionário
              existing.hours_expected = data.hours_per_day || "8:48:00";
            }
            
            // Corrigir horas extras se não há horários preenchidos
            const hasAnyEntry = existing.entry1 || existing.exit1 || existing.entry2 || existing.exit2;
            if (!hasAnyEntry || isAbsence) {
              existing.overtime = "0:00:00";
            } else {
              // Recalcular overtime com hours_expected correto
              existing.overtime = calculateOvertime(existing.hours_worked || "0:00:00", existing.hours_expected);
            }
            allEntries.push(existing);
          } else {
            allEntries.push({
              day,
              entry1: "",
              exit1: "",
              entry2: "",
              exit2: "",
              hours_worked: "0:00:00",
              hours_expected: isWeekend(day, data.month, data.year) ? "0:00:00" : (data.hours_per_day || "8:48:00"),
              overtime: "0:00:00",
              observation: isWeekend(day, data.month, data.year) ? getDayOfWeek(day, data.month, data.year) : "",
            });
          }
        }
        
        setEntries(allEntries);
        setIsDetailOpen(true);
      }
    } catch (error) {
      console.error("Error fetching timesheet:", error);
    }
  };

  const isAbsenceDay = (observation: string) => {
    const obs = (observation || "").toLowerCase().trim();
    return obs.includes("férias") || obs.includes("ferias") || obs.includes("feriado") || 
           obs.includes("atestado") || obs.includes("folga") || obs.includes("licença") ||
           obs.includes("licenca") || obs.includes("afastamento") || 
           obs.includes("sábado") || obs.includes("sabado") || obs.includes("domingo");
  };

  const formatTimeInput = (value: string): string => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, "");
    
    if (numbers.length <= 2) {
      return numbers;
    }
    
    // Adiciona os dois pontos após os 2 primeiros dígitos
    return `${numbers.slice(0, 2)}:${numbers.slice(2, 4)}`;
  };

  const handleTimeInput = (day: number, field: keyof TimesheetEntry, value: string) => {
    const formattedValue = formatTimeInput(value);
    updateEntry(day, field, formattedValue);
    
    // Auto-jump para próximo campo quando completar HH:MM (5 caracteres)
    if (formattedValue.length === 5) {
      const fieldOrder = ["entry1", "exit1", "entry2", "exit2"];
      const currentIndex = fieldOrder.indexOf(field as string);
      
      let nextField: string;
      let nextDay = day;
      
      if (currentIndex < fieldOrder.length - 1) {
        // Próximo campo do mesmo dia
        nextField = fieldOrder[currentIndex + 1];
      } else {
        // Primeiro campo do próximo dia
        nextField = "entry1";
        nextDay = day + 1;
      }
      
      setTimeout(() => {
        const nextInput = document.getElementById(`time-${nextDay}-${nextField}`);
        if (nextInput) {
          nextInput.focus();
        }
      }, 50);
    }
  };

  const handlePaste = (day: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData("text");
    
    // Divide por linhas para suportar múltiplas linhas coladas
    const lines = pastedText.split(/[\r\n]+/).filter(line => line.trim());
    
    // Extrai horários de cada linha
    const timePattern = /(\d{1,2}):?(\d{2})/g;
    const linesTimes: string[][] = [];
    
    for (const line of lines) {
      const times: string[] = [];
      let match;
      timePattern.lastIndex = 0; // Reset regex
      
      while ((match = timePattern.exec(line)) !== null) {
        const hours = match[1].padStart(2, "0");
        const minutes = match[2];
        times.push(`${hours}:${minutes}`);
      }
      
      if (times.length > 0) {
        linesTimes.push(times);
      }
    }
    
    // Se encontrou horários, preenche os campos automaticamente
    if (linesTimes.length > 0 && linesTimes.some(t => t.length > 1)) {
      e.preventDefault();
      
      setEntries(prev => prev.map(entry => {
        // Calcula qual linha corresponde a este dia (começando do dia onde colou)
        const lineIndex = entry.day - day;
        
        // Se não há linha para este dia ou dia é anterior ao colado, não altera
        if (lineIndex < 0 || lineIndex >= linesTimes.length) {
          return entry;
        }
        
        const times = linesTimes[lineIndex];
        if (!times || times.length < 2) {
          return entry;
        }
        
        const updated = { ...entry };
        
        // Preenche os 4 campos de horário
        if (times[0]) updated.entry1 = times[0];
        if (times[1]) updated.exit1 = times[1];
        if (times[2]) updated.entry2 = times[2];
        if (times[3]) updated.exit2 = times[3];
        
        // Define observação como "Dia útil" se não houver observação
        if (!entry.observation) {
          updated.observation = "Dia útil";
        }
        
        // Recalcula horas trabalhadas
        const hasAnyEntry = updated.entry1 || updated.exit1 || updated.entry2 || updated.exit2;
        if (hasAnyEntry) {
          updated.hours_worked = calculateWorkedHours(
            updated.entry1,
            updated.exit1,
            updated.entry2,
            updated.exit2
          );
          
          // Garante que hours_expected não seja zero para dias normais
          if (!updated.observation || updated.observation === "Dia útil" || updated.observation === "-") {
            if (isZeroTime(updated.hours_expected)) {
              updated.hours_expected = selectedTimesheet?.hours_per_day || "8:48:00";
            }
          }
          
          updated.overtime = calculateOvertime(updated.hours_worked, updated.hours_expected);
        }
        
        return updated;
      }));
    }
  };

  const clearRow = (day: number) => {
    setEntries(prev => prev.map(entry => {
      if (entry.day === day) {
        return {
          ...entry,
          entry1: "",
          exit1: "",
          entry2: "",
          exit2: "",
          hours_worked: "0:00:00",
          observation: "",
          hours_expected: selectedTimesheet?.hours_per_day || "8:48:00",
          overtime: calculateOvertime("0:00:00", selectedTimesheet?.hours_per_day || "8:48:00")
        };
      }
      return entry;
    }));
  };

  const clearAllRows = () => {
    setEntries(prev => prev.map(entry => ({
      ...entry,
      entry1: "",
      exit1: "",
      entry2: "",
      exit2: "",
      hours_worked: "0:00:00",
      observation: "",
      hours_expected: selectedTimesheet?.hours_per_day || "8:48:00",
      overtime: calculateOvertime("0:00:00", selectedTimesheet?.hours_per_day || "8:48:00")
    })));
  };

  const updateEntry = (day: number, field: keyof TimesheetEntry, value: string) => {
    setEntries(prev => prev.map(entry => {
      if (entry.day === day) {
        const updated = { ...entry, [field]: value };
        
        // Se a observação indica ausência, zerar horas previstas
        if (field === "observation") {
          if (value === "Falta") {
            // Falta: mantém horas previstas mas zera horas trabalhadas = overtime negativo
            const defaultHours = selectedTimesheet?.hours_per_day || "8:48:00";
            updated.hours_expected = defaultHours;
            updated.hours_worked = "0:00:00";
            updated.entry1 = "";
            updated.exit1 = "";
            updated.entry2 = "";
            updated.exit2 = "";
            updated.overtime = calculateOvertime("0:00:00", defaultHours);
          } else if (isAbsenceDay(value)) {
            updated.hours_expected = "0:00:00";
            updated.overtime = "0:00:00";
          } else if (value === "Dia útil" || value === "") {
            // Restaurar horas previstas normais do funcionário
            const defaultHours = selectedTimesheet?.hours_per_day || "8:48:00";
            updated.hours_expected = defaultHours;
            updated.overtime = calculateOvertime(updated.hours_worked, defaultHours);
          }
        }
        
        // Recalculate hours worked
        if (["entry1", "exit1", "entry2", "exit2"].includes(field)) {
          updated.hours_worked = calculateWorkedHours(updated.entry1, updated.exit1, updated.entry2, updated.exit2);
          
          // Se não há nenhum horário preenchido, zerar horas extras
          const hasAnyEntry = updated.entry1 || updated.exit1 || updated.entry2 || updated.exit2;
          if (!hasAnyEntry) {
            updated.overtime = "0:00:00";
          } else {
            // Garantir que hours_expected não seja zero para dias normais (não ausência)
            const obs = (updated.observation || "").toLowerCase().trim();
            const isAbsence = obs.includes("férias") || obs.includes("ferias") || obs.includes("feriado") || 
                             obs.includes("atestado") || obs.includes("folga") || obs.includes("licença") ||
                             obs.includes("licenca") || obs.includes("afastamento") ||
                             obs.includes("sábado") || obs.includes("sabado") || obs.includes("domingo");
            
            if (!isAbsence && isZeroTime(updated.hours_expected)) {
              updated.hours_expected = selectedTimesheet?.hours_per_day || "8:48:00";
            }
            updated.overtime = calculateOvertime(updated.hours_worked, updated.hours_expected);
          }
        }
        
        return updated;
      }
      return entry;
    }));
  };

  const handleSaveEntries = async () => {
    if (!selectedTimesheet) return;
    setIsSaving(true);
    
    try {
      // Calculate totals
      const totalWorked = sumTimes(entries.map(e => e.hours_worked));
      const totalExpected = sumTimes(entries.map(e => e.hours_expected));
      const totalOvertime = sumTimes(entries.map(e => e.overtime));
      
      // Save entries
      await fetch(`/api/timesheets/${selectedTimesheet.id}/entries`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
        credentials: "include",
      });
      
      // Update timesheet totals
      await fetch(`/api/timesheets/${selectedTimesheet.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: selectedTimesheet.status,
          total_worked: totalWorked,
          total_expected: totalExpected,
          total_overtime: totalOvertime,
        }),
        credentials: "include",
      });
      
      toast({ title: "Folha de ponto salva" });
      fetchTimesheets();
      setIsDetailOpen(false);
      setSelectedTimesheet(null);
    } catch (error) {
      console.error("Error saving entries:", error);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedTimesheet) return;
    
    const newStatus = selectedTimesheet.status === "CLOSED" ? "OPEN" : "CLOSED";
    
    if (newStatus === "CLOSED") {
      const ok = await confirm({
        title: "Fechar folha de ponto?",
        message: "Após fechar, a folha não poderá mais ser editada. Deseja continuar?",
        confirmText: "Fechar",
        cancelText: "Cancelar",
      });
      if (!ok) return;
    }
    
    try {
      // Calculate totals before closing
      const totalWorked = sumTimes(entries.map(e => e.hours_worked));
      const totalExpected = sumTimes(entries.map(e => e.hours_expected));
      const totalOvertime = sumTimes(entries.map(e => e.overtime));
      
      await fetch(`/api/timesheets/${selectedTimesheet.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          total_worked: totalWorked,
          total_expected: totalExpected,
          total_overtime: totalOvertime,
        }),
        credentials: "include",
      });
      
      setSelectedTimesheet({ ...selectedTimesheet, status: newStatus });
      toast({ title: newStatus === "CLOSED" ? "Folha fechada" : "Folha reaberta" });
      fetchTimesheets();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: "Excluir folha de ponto?",
      message: "Esta ação não pode ser desfeita.",
      confirmText: "Excluir",
      cancelText: "Cancelar",
    });
    if (!ok) return;
    
    try {
      const res = await fetch(`/api/timesheets/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        fetchTimesheets();
        toast({ title: "Folha de ponto excluída" });
      }
    } catch (error) {
      console.error("Error deleting timesheet:", error);
    }
  };

  const handleExportPDF = async () => {
    if (!printRef.current || !selectedTimesheet) return;
    
    try {
      toast({ title: "Gerando PDF..." });
      
      // Set printing mode and wait for re-render
      setIsPrinting(true);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(printRef.current, {
        scale: 1.5,
        useCORS: true,
        logging: false,
      });
      
      setIsPrinting(false);
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`folha-ponto-${selectedTimesheet.employee_name}-${selectedTimesheet.month}-${selectedTimesheet.year}.pdf`);
      
      toast({ title: "PDF exportado com sucesso" });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      setIsPrinting(false);
      toast({ title: "Erro ao exportar PDF", variant: "destructive" });
    }
  };

  const getWorkScheduleDisplay = () => {
    if (!selectedTimesheet?.work_schedule) return "-";
    try {
      const schedule = JSON.parse(selectedTimesheet.work_schedule);
      const monday = schedule.monday;
      if (monday?.is_rest) return "-";
      return `${monday?.morning_start || ""}-${monday?.morning_end || ""} / ${monday?.afternoon_start || ""}-${monday?.afternoon_end || ""}`;
    } catch {
      return "-";
    }
  };

  const totalWorked = sumTimes(entries.map(e => e.hours_worked));
  const totalExpected = sumTimes(entries.map(e => e.hours_expected));
  const totalOvertime = sumTimes(entries.map(e => e.overtime));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="w-7 h-7 text-primary" />
            Folha de Ponto
          </h1>
          <p className="text-muted-foreground mt-1">
            Controle de ponto dos funcionários
          </p>
        </div>
        <Button onClick={() => setIsNewOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nova Folha</span>
          <span className="sm:hidden">Novo</span>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select value={filterMonth.toString()} onValueChange={(v) => setFilterMonth(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={m.value.toString()}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ano</Label>
              <Select value={filterYear.toString()} onValueChange={(v) => setFilterYear(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2023, 2024, 2025, 2026].map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Funcionário</Label>
              <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id.toString()}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* New Timesheet Dialog */}
      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Folha de Ponto</DialogTitle>
            <DialogDescription>
              Selecione o funcionário e o período
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Funcionário *</Label>
              <Select
                value={newForm.employee_id}
                onValueChange={(v) => setNewForm({ ...newForm, employee_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id.toString()}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mês *</Label>
                <Select
                  value={newForm.month.toString()}
                  onValueChange={(v) => setNewForm({ ...newForm, month: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={m.value.toString()}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ano *</Label>
                <Select
                  value={newForm.year.toString()}
                  onValueChange={(v) => setNewForm({ ...newForm, year: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2023, 2024, 2025, 2026].map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsNewOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving || !newForm.employee_id}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Criar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : timesheets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma folha de ponto encontrada
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Horas Trabalhadas</TableHead>
                      <TableHead>Horas Extras</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timesheets.map((t) => (
                      <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleOpenDetail(t)}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{t.employee_name}</p>
                            <p className="text-xs text-muted-foreground">{t.employee_role}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {MONTHS.find(m => m.value === t.month)?.label} / {t.year}
                        </TableCell>
                        <TableCell className="font-mono">{t.total_worked || "-"}</TableCell>
                        <TableCell className={`font-mono ${t.total_overtime?.startsWith("-") ? "text-red-600" : "text-green-600"}`}>
                          {t.total_overtime || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={t.status === "CLOSED" ? "secondary" : "default"}>
                            {t.status === "CLOSED" ? "Fechada" : "Aberta"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDetail(t)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(t.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y">
                {timesheets.map((t) => (
                  <div key={t.id} className="p-4 space-y-2" onClick={() => handleOpenDetail(t)}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{t.employee_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {MONTHS.find(m => m.value === t.month)?.label} / {t.year}
                        </p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-xs font-mono">{t.total_worked || "-"}</span>
                          <Badge variant={t.status === "CLOSED" ? "secondary" : "default"} className="text-xs">
                            {t.status === "CLOSED" ? "Fechada" : "Aberta"}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDetail(t)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(t.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Folha de Ponto
                </DialogTitle>
                <DialogDescription>
                  {selectedTimesheet?.employee_name} - {MONTHS.find(m => m.value === selectedTimesheet?.month)?.label} / {selectedTimesheet?.year}
                </DialogDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2">
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">PDF</span>
                </Button>
                <Button
                  variant={selectedTimesheet?.status === "CLOSED" ? "outline" : "secondary"}
                  size="sm"
                  onClick={handleToggleStatus}
                  className="gap-2"
                >
                  {selectedTimesheet?.status === "CLOSED" ? (
                    <>
                      <Unlock className="w-4 h-4" />
                      <span className="hidden sm:inline">Reabrir</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span className="hidden sm:inline">Fechar</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Printable Content */}
          <div ref={printRef} className={`bg-white mt-4 ${isPrinting ? "p-2 text-[9px]" : "p-4"}`}>
            {/* Header Info */}
            <div className={`text-center ${isPrinting ? "mb-1" : "mb-4"}`}>
              <h2 className={`font-bold ${isPrinting ? "text-sm" : "text-xl"}`}>FOLHA DE PONTO</h2>
            </div>
            
            <div className={`grid grid-cols-2 md:grid-cols-4 border bg-muted/30 ${isPrinting ? "gap-1 p-1.5 mb-1 text-[9px]" : "gap-2 text-sm mb-4 p-3"}`}>
              <div>
                <span className="text-muted-foreground">Empregado(a):</span>
                <p className="font-medium">{selectedTimesheet?.employee_name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Função:</span>
                <p className="font-medium">{selectedTimesheet?.employee_role || "-"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">CTPS Nº / Série:</span>
                <p className="font-medium">
                  {selectedTimesheet?.ctps_numero || "-"} / {selectedTimesheet?.ctps_serie || "-"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Data Admissão:</span>
                <p className="font-medium">
                  {selectedTimesheet?.admission_date ? new Date(selectedTimesheet.admission_date).toLocaleDateString("pt-BR") : "-"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Horário Seg-Sex:</span>
                <p className="font-medium">{getWorkScheduleDisplay()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Horário Sábado:</span>
                <p className="font-medium">{selectedTimesheet?.saturday_schedule || "-"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Descanso Semanal:</span>
                <p className="font-medium">{selectedTimesheet?.weekly_rest || "-"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Mês/Ano:</span>
                <p className="font-medium">
                  {MONTHS.find(m => m.value === selectedTimesheet?.month)?.label} / {selectedTimesheet?.year}
                </p>
              </div>
            </div>

            {/* Entries Table */}
            <div className="overflow-x-auto">
              {!isPrinting && (
                <div className="flex justify-end mb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAllRows}
                    disabled={selectedTimesheet?.status === "CLOSED"}
                    className="text-xs"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Limpar Tudo
                  </Button>
                </div>
              )}
              <Table className={isPrinting ? "text-[9px]" : "text-xs"}>
                <TableHeader>
                  <TableRow className={`bg-muted/50 ${isPrinting ? "h-5" : ""}`}>
                    <TableHead className={`text-center ${isPrinting ? "w-6 p-0.5" : "w-10"}`}>Dia</TableHead>
                    <TableHead className={`text-center ${isPrinting ? "w-12 p-0.5" : "w-20"}`}>Entrada</TableHead>
                    <TableHead className={`text-center ${isPrinting ? "w-12 p-0.5" : "w-20"}`}>Saída</TableHead>
                    <TableHead className={`text-center ${isPrinting ? "w-12 p-0.5" : "w-20"}`}>Entrada</TableHead>
                    <TableHead className={`text-center ${isPrinting ? "w-12 p-0.5" : "w-20"}`}>Saída</TableHead>
                    <TableHead className={`text-center ${isPrinting ? "w-14 p-0.5" : "w-24"}`}>Horas Trab.</TableHead>
                    <TableHead className={`${isPrinting ? "w-16 p-0.5" : "w-28"}`}>Obs.</TableHead>
                    <TableHead className={`text-center ${isPrinting ? "w-14 p-0.5" : "w-24"}`}>Horas Prev.</TableHead>
                    <TableHead className={`text-center ${isPrinting ? "w-14 p-0.5" : "w-24"}`}>Horas Extras</TableHead>
                    {!isPrinting && <TableHead className="w-10 text-center"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const weekend = selectedTimesheet ? isWeekend(entry.day, selectedTimesheet.month, selectedTimesheet.year) : false;
                    const isClosed = selectedTimesheet?.status === "CLOSED";
                    
                    return (
                      <TableRow key={entry.day} className={`${weekend ? "bg-muted/30" : ""} ${isPrinting ? "h-5" : ""}`}>
                        <TableCell className={`text-center font-medium ${isPrinting ? "p-0.5 text-[10px]" : ""}`}>{entry.day}</TableCell>
                        <TableCell className={`text-center ${isPrinting ? "p-0.5" : "p-1"}`}>
                          {isPrinting ? (
                            <span className="text-[10px] font-mono">{entry.entry1 || "-"}</span>
                          ) : (
                            <Input
                              id={`time-${entry.day}-entry1`}
                              type="text"
                              placeholder="HH:MM"
                              maxLength={5}
                              className="h-7 text-xs text-center font-mono"
                              value={entry.entry1}
                              onChange={(e) => handleTimeInput(entry.day, "entry1", e.target.value)}
                              onPaste={(e) => handlePaste(entry.day, e)}
                              disabled={isClosed}
                            />
                          )}
                        </TableCell>
                        <TableCell className={`text-center ${isPrinting ? "p-0.5" : "p-1"}`}>
                          {isPrinting ? (
                            <span className="text-[10px] font-mono">{entry.exit1 || "-"}</span>
                          ) : (
                            <Input
                              id={`time-${entry.day}-exit1`}
                              type="text"
                              placeholder="HH:MM"
                              maxLength={5}
                              className="h-7 text-xs text-center font-mono"
                              value={entry.exit1}
                              onChange={(e) => handleTimeInput(entry.day, "exit1", e.target.value)}
                              onPaste={(e) => handlePaste(entry.day, e)}
                              disabled={isClosed}
                            />
                          )}
                        </TableCell>
                        <TableCell className={`text-center ${isPrinting ? "p-0.5" : "p-1"}`}>
                          {isPrinting ? (
                            <span className="text-[10px] font-mono">{entry.entry2 || "-"}</span>
                          ) : (
                            <Input
                              id={`time-${entry.day}-entry2`}
                              type="text"
                              placeholder="HH:MM"
                              maxLength={5}
                              className="h-7 text-xs text-center font-mono"
                              value={entry.entry2}
                              onChange={(e) => handleTimeInput(entry.day, "entry2", e.target.value)}
                              onPaste={(e) => handlePaste(entry.day, e)}
                              disabled={isClosed}
                            />
                          )}
                        </TableCell>
                        <TableCell className={`text-center ${isPrinting ? "p-0.5" : "p-1"}`}>
                          {isPrinting ? (
                            <span className="text-[10px] font-mono">{entry.exit2 || "-"}</span>
                          ) : (
                            <Input
                              id={`time-${entry.day}-exit2`}
                              type="text"
                              placeholder="HH:MM"
                              maxLength={5}
                              className="h-7 text-xs text-center font-mono"
                              value={entry.exit2}
                              onChange={(e) => handleTimeInput(entry.day, "exit2", e.target.value)}
                              onPaste={(e) => handlePaste(entry.day, e)}
                              disabled={isClosed}
                            />
                          )}
                        </TableCell>
                        <TableCell className={`text-center font-mono ${isPrinting ? "p-0.5 text-[10px]" : ""}`}>{entry.hours_worked}</TableCell>
                        <TableCell className={isPrinting ? "p-0.5" : "p-1"}>
                          {isPrinting ? (
                            <span className="text-[10px]">{entry.observation || "-"}</span>
                          ) : (
                            <Select
                              value={entry.observation || "-"}
                              onValueChange={(v) => updateEntry(entry.day, "observation", v === "-" ? "" : v)}
                              disabled={isClosed}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="-" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="-">-</SelectItem>
                                <SelectItem value="Dia útil">Dia útil</SelectItem>
                                <SelectItem value="Falta">Falta</SelectItem>
                                <SelectItem value="Férias">Férias</SelectItem>
                                <SelectItem value="Feriado">Feriado</SelectItem>
                                <SelectItem value="Atestado">Atestado</SelectItem>
                                <SelectItem value="Folga">Folga</SelectItem>
                                <SelectItem value="Licença">Licença</SelectItem>
                                <SelectItem value="Afastamento">Afastamento</SelectItem>
                                <SelectItem value="Sábado">Sábado</SelectItem>
                                <SelectItem value="Domingo">Domingo</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className={`text-center font-mono ${isPrinting ? "p-0.5 text-[10px]" : ""}`}>{entry.hours_expected}</TableCell>
                        <TableCell className={`text-center font-mono ${isPrinting ? "p-0.5 text-[10px]" : ""} ${entry.overtime.startsWith("-") ? "text-red-600" : "text-green-600"}`}>
                          {entry.overtime}
                        </TableCell>
                        {!isPrinting && (
                          <TableCell className="p-1 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => clearRow(entry.day)}
                              disabled={isClosed}
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {/* Totals Row */}
                  <TableRow className={`bg-muted/50 font-bold ${isPrinting ? "h-5" : ""}`}>
                    <TableCell colSpan={5} className={`text-right ${isPrinting ? "p-0.5 text-[10px]" : ""}`}>TOTAL:</TableCell>
                    <TableCell className={`text-center font-mono ${isPrinting ? "p-0.5 text-[10px]" : ""}`}>{totalWorked}</TableCell>
                    <TableCell className={isPrinting ? "p-0.5" : ""}></TableCell>
                    <TableCell className={`text-center font-mono ${isPrinting ? "p-0.5 text-[10px]" : ""}`}>{totalExpected}</TableCell>
                    <TableCell className={`text-center font-mono ${isPrinting ? "p-0.5 text-[10px]" : ""} ${totalOvertime.startsWith("-") ? "text-red-600" : "text-green-600"}`}>
                      {totalOvertime}
                    </TableCell>
                    {!isPrinting && <TableCell></TableCell>}
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Signature Section */}
            <div className={`border-t flex justify-between ${isPrinting ? "mt-2 pt-2 text-[9px]" : "mt-8 pt-4 text-sm"}`}>
              <div className="flex-1">
                <p>ASSINATURA: _______________________________</p>
              </div>
              <div>
                <p>DATA: ____/____/________</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          {selectedTimesheet?.status !== "CLOSED" && (
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEntries} disabled={isSaving} className="gap-2">
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
