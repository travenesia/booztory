"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastIcon,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="flex flex-col gap-1 flex-1">
              <div className="flex items-center gap-2">
                <ToastIcon variant={props.variant} />
                {title && (
                  <ToastTitle className={
                    props.variant === "success" ? "text-emerald-700" :
                    props.variant === "destructive" ? "text-red-700" :
                    props.variant === "warning" ? "text-amber-700" :
                    "text-gray-800"
                  }>{title}</ToastTitle>
                )}
              </div>
              {description && (
                <ToastDescription className="pl-6">{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
