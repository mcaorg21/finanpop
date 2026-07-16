import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/react-app/components/ui/dialog";
import { Button } from "@/react-app/components/ui/button";

export default function TutorialModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if user has dismissed the tutorial
    const dismissed = localStorage.getItem("tutorialDismissed");
    if (!dismissed) {
      setIsOpen(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("tutorialDismissed", "true");
    setIsOpen(false);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">Dicas para começar</DialogTitle>
          <DialogDescription className="text-sm">
            Siga estes passos para configurar o sistema
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted text-foreground flex items-center justify-center text-sm font-medium">
              1
            </div>
            <div className="flex-1">
              <p className="text-sm">
                Cadastre os <span className="font-semibold">Centros de Custo</span> que são os locais/projetos/conta pessoal que você vai gerenciar
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted text-foreground flex items-center justify-center text-sm font-medium">
              2
            </div>
            <div className="flex-1">
              <p className="text-sm">
                Cadastre os <span className="font-semibold">Funcionários</span> caso os tenha (pessoas que trabalham nos centros de custo)
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted text-foreground flex items-center justify-center text-sm font-medium">
              3
            </div>
            <div className="flex-1">
              <p className="text-sm">
                Verifique as <span className="font-semibold">Categorias</span> (tipos de despesa e receita)
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted text-foreground flex items-center justify-center text-sm font-medium">
              4
            </div>
            <div className="flex-1">
              <p className="text-sm">
                Comece a fazer <span className="font-semibold">Registros</span> de receitas e despesas
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted text-foreground flex items-center justify-center text-sm font-medium">
              5
            </div>
            <div className="flex-1">
              <p className="text-sm">
                Use os <span className="font-semibold">Relatórios</span> para acompanhar a evolução financeira
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Fechar
          </Button>
          <Button onClick={handleDismiss}>
            Não mostrar novamente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
