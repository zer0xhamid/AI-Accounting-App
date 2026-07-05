import { create } from 'zustand'

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

interface AppState {
  toasts: Toast[]
  addToast: (message: string, type: Toast['type']) => void
  removeToast: (id: number) => void
}

let toastId = 0

export const useAppStore = create<AppState>((set) => ({
  toasts: [],
  addToast: (message, type) => {
    const id = ++toastId
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 3000)
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },
}))
