import { create } from 'zustand';
import { AlertCircle, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface AlertState {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  onClose?: () => void;
}

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface AlertStore extends AlertState {
  showAlert: (config: Omit<AlertState, 'isOpen'>) => void;
  hideAlert: () => void;
}

interface ConfirmStore extends ConfirmState {
  showConfirm: (config: Omit<ConfirmState, 'isOpen'>) => Promise<boolean>;
  hideConfirm: (confirmed: boolean) => void;
  resolvePromise?: (value: boolean) => void;
}

export const useAlertStore = create<AlertStore>((set) => ({
  isOpen: false,
  title: '',
  message: '',
  type: 'info',
  showAlert: (config) => set({ ...config, isOpen: true }),
  hideAlert: () => set({ isOpen: false }),
}));

export const useConfirmStore = create<ConfirmStore>((set, get) => ({
  isOpen: false,
  title: '',
  message: '',
  confirmText: 'Confirmar',
  cancelText: 'Cancelar',
  showConfirm: (config) => {
    return new Promise<boolean>((resolve) => {
      set({ 
        ...config, 
        isOpen: true,
        resolvePromise: resolve,
      });
    });
  },
  hideConfirm: (confirmed) => {
    const { resolvePromise, onConfirm, onCancel } = get();
    if (confirmed && onConfirm) onConfirm();
    if (!confirmed && onCancel) onCancel();
    if (resolvePromise) resolvePromise(confirmed);
    set({ isOpen: false, resolvePromise: undefined });
  },
}));

export const useAlert = () => {
  const { showAlert } = useAlertStore();
  const { showConfirm } = useConfirmStore();

  return {
    alert: (message: string, title = 'Aviso', type = 'info' as const) => {
      showAlert({ title, message, type });
    },
    success: (message: string, title = 'Sucesso') => {
      showAlert({ title, message, type: 'success' });
    },
    error: (message: string, title = 'Erro') => {
      showAlert({ title, message, type: 'error' });
    },
    warning: (message: string, title = 'Atenção') => {
      showAlert({ title, message, type: 'warning' });
    },
    confirm: (config: { title: string; message: string; confirmText?: string; cancelText?: string }) => {
      return showConfirm(config);
    },
  };
};

export function AlertDialog() {
  const { isOpen, title, message, type, hideAlert } = useAlertStore();

  if (!isOpen) return null;

  const icons = {
    info: AlertCircle,
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
  };

  const colors = {
    info: 'text-blue-600',
    success: 'text-green-600',
    error: 'text-red-600',
    warning: 'text-amber-600',
  };

  const Icon = icons[type];

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={hideAlert} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-start gap-4">
          <Icon className={`h-6 w-6 mt-0.5 ${colors[type]}`} />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {message}
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={hideAlert}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog() {
  const { isOpen, title, message, confirmText, cancelText, hideConfirm } = useConfirmStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => hideConfirm(false)} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className="h-6 w-6 mt-0.5 text-amber-600" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {message}
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => hideConfirm(false)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {cancelText || 'Cancelar'}
          </button>
          <button
            onClick={() => hideConfirm(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            {confirmText || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
