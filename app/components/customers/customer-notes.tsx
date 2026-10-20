import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"
import { AppForm } from "~/components/app-form"
import FormLabel from "~/components/form-label"
import { Alert, AlertAction, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { Textarea } from "~/components/ui/textarea"
import { formatDateTime } from "~/lib/format-preference"
import { customerNoteSchema } from "~/lib/schemas/customers"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"
import { useOrganizationPermission } from "~/lib/use-organization-access"

export function CustomerNotes({ customerId, onPendingChange }: { customerId: string; onPendingChange: (pending: boolean) => void }) {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const query = useInfiniteQuery(trpc.customer.listNotes.infiniteQueryOptions({ id: customerId, limit: 20 }, { getNextPageParam: (page) => page.nextCursor }))
  const add = useMutation(trpc.customer.addNote.mutationOptions())
  const update = useMutation(trpc.customer.updateNote.mutationOptions())
  const [editing, setEditing] = useState<{ id?: string; body: string } | null>(null)
  const canUpdate = useOrganizationPermission({ customers: ["update"] })
  const notes = query.data?.pages.flatMap((page) => page.items) ?? []
  const pending = add.isPending || update.isPending
  const options = { formatPreference: root?.formatPreference ?? "eu", language: root?.locale === "fi" ? "fi" as const : "en" as const, timeZone: root?.organizationTimezone ?? "Europe/Helsinki" }

  return <div className="grid gap-5">
    <Alert variant="info"><AlertTitle>{t("customerPage.notesPrivate")}</AlertTitle></Alert>
    {canUpdate && !editing ? <Button className="justify-self-start" onClick={() => setEditing({ body: "" })} type="button" variant="outline">{t("customerPage.addNote")}</Button> : null}
    {canUpdate && editing ? <AppForm
      defaultValues={{ body: editing.body }}
      key={editing.id ?? "new"}
      onFormStateChange={({ isSubmitting }) => onPendingChange(isSubmitting)}
      schema={customerNoteSchema}
      submitFn={async ({ body }) => {
        onPendingChange(true)
        try {
          if (editing.id) await update.mutateAsync({ id: customerId, noteId: editing.id, body })
          else await add.mutateAsync({ id: customerId, body })
          await queryClient.invalidateQueries(trpc.customer.listNotes.queryFilter({ id: customerId }))
          setEditing(null)
          toast.success(t("customerPage.noteSaved"))
        } catch (error) {
          toast.error(t("customerPage.noteSaveError"))
          throw error
        } finally {
          onPendingChange(false)
        }
      }}
    >{(form) => <>
      <FormLabel error={form.error("body")} label={t(editing.id ? "customerPage.editNote" : "customerPage.newNote")}><Textarea {...form.getInputProps("body")} aria-invalid={Boolean(form.error("body"))} disabled={form.formState.isSubmitting} rows={4} /></FormLabel>
      <div className="flex justify-end gap-2"><Button disabled={form.formState.isSubmitting} onClick={() => setEditing(null)} type="button" variant="ghost">{t("customerPage.cancel")}</Button><Button disabled={form.formState.isSubmitting} loading={form.formState.isSubmitting} type="submit">{t("customerPage.saveNote")}</Button></div>
    </>}</AppForm> : null}
    {query.isError ? <Alert variant="error"><AlertTitle>{t("customerPage.notesError")}</AlertTitle><AlertAction><Button disabled={query.isFetching} onClick={() => void query.refetch()} size="sm" type="button" variant="outline">{t("customerPage.retry")}</Button></AlertAction></Alert> : null}
    {query.isPending ? <div className="flex justify-center py-6"><Spinner aria-label={t("customerPage.loading")} /></div> : !notes.length && !query.isError ? <p className="py-3 text-sm text-muted-foreground">{t("customerPage.noNotes")}</p> : null}
    <ul className="grid gap-3">{notes.map((note) => <li className="grid gap-3 rounded-lg border p-4" key={note.id}>
      <div className="flex items-start justify-between gap-3"><div className="grid gap-1"><span className="text-sm font-medium">{note.authorName ?? t("customerPage.staffNote")}</span><time className="text-xs text-muted-foreground" dateTime={new Date(note.createdAt).toISOString()}>{formatDateTime(note.createdAt, options)}{+new Date(note.updatedAt) > +new Date(note.createdAt) ? ` · ${t("customerPage.edited")}` : ""}</time></div>{canUpdate ? <Button disabled={pending || Boolean(editing)} onClick={() => setEditing({ id: note.id, body: note.body })} size="sm" type="button" variant="ghost">{t("customerPage.editNote")}</Button> : null}</div>
      <p className="whitespace-pre-wrap break-words text-sm leading-6">{note.body}</p>
    </li>)}</ul>
    {query.hasNextPage ? <Button disabled={query.isFetchingNextPage} loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()} type="button" variant="outline">{t("customerPage.loadMore")}</Button> : null}
  </div>
}
