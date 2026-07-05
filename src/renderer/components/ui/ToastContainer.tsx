import { useAppStore } from '../../store/appStore'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

export default function ToastContainer() {
  const { toasts, removeToast } = useAppStore()

  if (toasts.length === 0) return null

  return (
    <div style={styles.container}>
      {toasts.map((toast) => {
        const Icon = toast.type === 'success' ? CheckCircle : toast.type === 'error' ? XCircle : Info
        const color = toast.type === 'success' ? 'var(--success)' : toast.type === 'error' ? 'var(--danger)' : 'var(--info)'

        return (
          <div key={toast.id} style={{ ...styles.toast, borderRightColor: color }} className="animate-slideIn">
            <Icon size={18} style={{ color, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} style={styles.closeBtn}>
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: 20,
    left: 20,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-glass)',
    borderRight: '3px solid',
    borderRadius: 'var(--radius-sm)',
    boxShadow: 'var(--shadow-lg)',
    fontSize: 14,
    minWidth: 280,
    maxWidth: 400,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 4,
    flexShrink: 0,
  },
}
