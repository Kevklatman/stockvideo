interface ToastProps {
    message: string;
    type?: 'success' | 'error';
    onClose?: () => void;
  }
  
  export function Toast({ message, type = 'success', onClose }: ToastProps) {
    const bgColor = type === 'success' ? 'bg-green-100' : 'bg-red-100';
    const textColor = type === 'success' ? 'text-green-700' : 'text-red-700';
    const borderColor = type === 'success' ? 'border-green-400' : 'border-red-400';
  
    return (
      <div className={`fixed top-4 right-4 ${bgColor} border ${borderColor} ${textColor} px-4 py-3 rounded shadow-md flex items-center`}>
        <span>{message}</span>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-4 text-xl font-semibold hover:opacity-75"
          >
            ×
          </button>
        )}
      </div>
    );
  }