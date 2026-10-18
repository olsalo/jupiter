import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { flushSync } from "react-dom"
import { useTranslation } from "react-i18next"

import { applyServiceOrder, createServiceOrderQueue } from "~/lib/service-order"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"

export function useServiceOrder() {
  const { t } = useTranslation("services")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const services = useQuery(trpc.service.list.queryOptions())
  const mutation = useMutation(trpc.service.reorder.mutationOptions())
  const [order, setOrder] = useState<string[] | null>(null)
  const errorLabel = useRef(t("reorderError"))
  errorLabel.current = t("reorderError")
  const [queue] = useState(() => createServiceOrderQueue({
    getIds: () => (queryClient.getQueryData(trpc.service.list.queryKey()) ?? []).map((item) => item.id),
    save: async (ids) => {
      await mutation.mutateAsync({ ids })
      // Retain current service details when an order response arrives
      queryClient.setQueryData(trpc.service.list.queryKey(), (previous) => applyServiceOrder(previous ?? [], ids).map((item, sortOrder) => ({ ...item, sortOrder })))
    },
    refresh: () => queryClient.invalidateQueries(trpc.service.list.queryFilter()),
    onIdle: () => setOrder(null),
    onError: () => toast.error(errorLabel.current),
  }))

  return {
    services,
    items: applyServiceOrder(services.data ?? [], order),
    reorder(ids: string[]) {
      // Commit each drop before the sortable rows can render their old order
      flushSync(() => setOrder(ids))
      void queue.enqueue(ids)
    },
  }
}
