import { AlertTriangle, Info } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'info';
}

function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'info',
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const Icon = variant === 'danger' ? AlertTriangle : Info;
  const iconColor = variant === 'danger' ? 'text-red-400' : 'text-blue-400';
  const confirmButtonColor =
    variant === 'danger'
      ? 'bg-red-500 hover:bg-red-600'
      : 'bg-blue-500 hover:bg-blue-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md w-full shadow-xl">
        <div className="flex items-start gap-4">
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-full ${
              variant === 'danger' ? 'bg-red-500/10' : 'bg-blue-500/10'
            } flex items-center justify-center`}
          >
            <Icon size={24} className={iconColor} />
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
            <p className="text-gray-400 text-sm mb-6">{message}</p>

            <div className="flex gap-3">
              <button
                onClick={onConfirm}
                className={`flex-1 py-2 ${confirmButtonColor} text-white rounded-lg font-medium transition-colors`}
              >
                {confirmText}
              </button>
              <button
                onClick={onCancel}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                {cancelText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
