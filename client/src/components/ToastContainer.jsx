import { createPortal } from 'react-dom'
import { Check, XCircle, AlertTriangle, Info } from 'lucide-react'
import { useToast } from '../context/ToastContext'

const iconMap = {
  success: <Check size={16} />,
  error: <XCircle size={16} />,
  warning: <AlertTriangle size={16} />,
  info: <Info size={16} />,
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToast()

  return createPortal(
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type}`}
          onClick={() => removeToast(toast.id)}
        >
          <span className="toast-icon">
            {iconMap[toast.type]}
          </span>
          <span className="toast-message">{toast.message}</span>
        </div>
      ))}
    </div>,
    document.body
  )
}
