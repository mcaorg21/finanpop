import { BrowserRouter as Router, Routes, Route } from "react-router";
import LandingPage from "@/react-app/pages/Landing";
import FuncionalidadesPage from "@/react-app/pages/Funcionalidades";
import LoginPage from "@/react-app/pages/Login";
import RegisterPage from "@/react-app/pages/Register";
import AdminLoginPage from "@/react-app/pages/AdminLogin";
import AdminDashboard from "@/react-app/pages/AdminDashboard";
import DashboardLayout from "@/react-app/components/layout/DashboardLayout";
import { Toaster } from "@/react-app/components/ui/toaster";
import { AlertDialog, ConfirmDialog } from "@/react-app/hooks/use-alert";
import DashboardPage from "@/react-app/pages/Dashboard";
import DomiciliosPage from "@/react-app/pages/cadastro/Domicilios";
import FuncionariosPage from "@/react-app/pages/cadastro/Funcionarios";
import CategoriasPage from "@/react-app/pages/cadastro/Categorias";
import EmpresasPage from "@/react-app/pages/cadastro/Empresas";
import RegistroPage from "@/react-app/pages/Registro";
import RelatoriosPage from "@/react-app/pages/Relatorios";
import ConfiguracoesPage from "@/react-app/pages/Configuracoes";
import FolhaPontoPage from "@/react-app/pages/FolhaPonto";
import AjudaPage from "@/react-app/pages/Ajuda";

export default function App() {
  return (
    <Router>
      <Toaster />
      <AlertDialog />
      <ConfirmDialog />
      <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/funcionalidades" element={<FuncionalidadesPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/admin" element={<AdminLoginPage />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/cadastro/domicilios" element={<DomiciliosPage />} />
        <Route path="/cadastro/funcionarios" element={<FuncionariosPage />} />
        <Route path="/cadastro/categorias" element={<CategoriasPage />} />
        <Route path="/cadastro/empresas" element={<EmpresasPage />} />
        <Route path="/registro" element={<RegistroPage />} />
        <Route path="/relatorios" element={<RelatoriosPage />} />
        <Route path="/folha-ponto" element={<FolhaPontoPage />} />
        <Route path="/configuracoes" element={<ConfiguracoesPage />} />
        <Route path="/ajuda" element={<AjudaPage />} />
      </Route>
      </Routes>
    </Router>
  );
}
