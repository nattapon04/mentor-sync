import { AlertTriangle, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = true
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-full ${isDestructive ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-foreground">{title}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <div className="p-4 border-t border-border bg-muted/30 flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors">
            {cancelText}
          </button>
          <button onClick={() => {
            onConfirm();
            onCancel(); // Auto-close
          }} className={`px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors ${isDestructive ? 'bg-rose-500 hover:bg-rose-600' : 'bg-primary hover:bg-primary/90'}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
