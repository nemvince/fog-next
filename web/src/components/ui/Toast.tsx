import { cn } from '@/lib/utils'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { X } from 'lucide-react'
import { create } from 'zustand'

// ─── Store ────────────────────────────────────────────────────────────────────

interface ToastItem {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'success' | 'destructive'
}

interface ToastStore {
  toasts: ToastItem[]
  add: (t: Omit<ToastItem, 'id'>) => void
  remove: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (t) =>
    set((s) => ({ toasts: [...s.toasts, { ...t, id: crypto.randomUUID() }] })),
  remove: (id) =>
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))

export function toast(title: string, opts?: { description?: string; variant?: ToastItem['variant'] }) {
  useToastStore.getState().add({ title, ...opts })
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toasts, remove } = useToastStore()

  return (
    <ToastPrimitive.Provider>
      {children}
      {toasts.map((t) => (
        <ToastPrimitive.Root
          key={t.id}
          open
          onOpenChange={(open) => !open && remove(t.id)}
          className={cn(
            'flex items-start gap-3 rounded-lg border p-4 shadow-lg',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-right-full',
            t.variant === 'destructive'
              ? 'border-red-800 bg-red-950 text-red-200'
              : t.variant === 'success'
                ? 'border-green-800 bg-green-950 text-green-200'
                : 'border-gray-800 bg-gray-900 text-gray-100',
          )}
        >
          <div className="flex-1">
            <ToastPrimitive.Title className="text-sm font-semibold">{t.title}</ToastPrimitive.Title>
            {t.description && (
              <ToastPrimitive.Description className="mt-0.5 text-xs opacity-70">
                {t.description}
              </ToastPrimitive.Description>
            )}
          </div>
          <ToastPrimitive.Close
            onClick={() => remove(t.id)}
            className="text-current opacity-50 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-100 flex w-80 flex-col gap-2" />
    </ToastPrimitive.Provider>
  )
}
