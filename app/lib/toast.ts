import { anchoredToastManager, toastManager } from "~/components/ui/toast"

export { anchoredToastManager, toastManager }
import type { ReactNode } from "react"
import { getSubmissionErrorToastRemovalHandler } from "~/lib/browser/submission-recovery"

type ToastOptions = {
  description?: ReactNode
  timeout?: number
  title: ReactNode
}

function addToast(type: string, options: ToastOptions) {
  return toastManager.add({
    ...options,
    type,
    onRemove: type === "error" ? getSubmissionErrorToastRemovalHandler() : undefined,
  })
}

export const toast = {
  close: (toastId?: string) => toastManager.close(toastId),
  error: (title: ReactNode, description?: ReactNode) =>
    addToast("error", { description, title }),
  info: (title: ReactNode, description?: ReactNode) =>
    addToast("info", { description, title }),
  loading: (title: ReactNode, description?: ReactNode) =>
    addToast("loading", { description, title }),
  success: (title: ReactNode, description?: ReactNode) =>
    addToast("success", { description, title }),
  warning: (title: ReactNode, description?: ReactNode) =>
    addToast("warning", { description, title }),
}
