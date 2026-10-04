import { dehydrate, useQuery, useQueryClient } from "@tanstack/react-query"
import { useLayoutEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Outlet, useNavigate } from "react-router"

import type { Route } from "./+types/form-dialog"
import { FormWorkspaceDialog } from "~/components/forms/form-workspace-dialog"
import { getClientTRPC, getQueryClient, useTRPC } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import { shouldRevalidateAppRoute } from "~/lib/should-revalidate"

export async function loader(args: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(args)
  await Promise.allSettled([
    queryClient.query(trpc.forms.get.queryOptions({ id: args.params.id })),
    queryClient.query(trpc.forms.settings.get.queryOptions({ id: args.params.id })),
    queryClient.query(trpc.forms.responses.list.queryOptions({ id: args.params.id })),
  ])

  return { queryClient: dehydrate(queryClient) }
}

export function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { queryClient, trpc } = getClientTRPC()
  // Warm the cache without delaying the dialog opening.
  void Promise.allSettled([
    queryClient.query(trpc.forms.get.queryOptions({ id: params.id })),
    queryClient.query(trpc.forms.settings.get.queryOptions({ id: params.id })),
    queryClient.query(trpc.forms.responses.list.queryOptions({ id: params.id })),
  ])

  return null
}

export function shouldRevalidate(args: Parameters<typeof shouldRevalidateAppRoute>[0]) {
  return args.currentParams.id !== args.nextParams.id || shouldRevalidateAppRoute(args)
}

export default function FormDialog({ params }: Route.ComponentProps) {
  const { t } = useTranslation("forms")
  const trpc = useTRPC()
  const forms = useQuery(trpc.forms.list.queryOptions())

  const form = forms.data?.find((item) => item.id === params.id)
  const title = form?.title.replace(/^Untitled(?=_\d+$|$)/, t("untitled")) ?? t("workspace.form")

  return <FormDialogContent formId={params.id} key={params.id} status={form?.status ?? "DRAFT"} title={title} />
}

function FormDialogContent({ formId, status, title }: {
  formId: string
  status: "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED"
  title: string
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const trpc = useTRPC()
  const [open, setOpen] = useState(false)
  const pendingSaveRef = useRef<Promise<void>>(Promise.resolve())
  const activeRef = useRef(false)

  useLayoutEffect(() => {
    activeRef.current = true
    setOpen(true)
    return () => { activeRef.current = false }
  }, [])

  return (
    <FormWorkspaceDialog
      formId={formId}
      onClose={(save) => {
        pendingSaveRef.current = save
        setOpen(false)
      }}
      onCloseComplete={() => {
        void pendingSaveRef.current.then(async () => {
          if (!activeRef.current) return
          const formOptions = trpc.forms.get.queryOptions({ id: formId })
          await queryClient.cancelQueries({ queryKey: formOptions.queryKey })
          await queryClient.invalidateQueries({ queryKey: formOptions.queryKey, refetchType: "none" })
          if (!activeRef.current) return
          // Refresh the list in the background so closing never waits for a read.
          void queryClient.invalidateQueries(trpc.forms.list.queryFilter())
          await navigate("/forms", { replace: true })
        }).catch(() => {
          if (activeRef.current) setOpen(true)
        })
      }}
      open={open}
      status={status}
      title={title}
    >
      <Outlet />
    </FormWorkspaceDialog>
  )
}
