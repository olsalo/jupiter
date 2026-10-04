import type { FormApi } from "@rvf/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { AppForm } from "~/components/app-form"
import FormLabel from "~/components/form-label"
import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import {
  Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader,
  DialogPanel, DialogPopup, DialogTitle, DialogTrigger,
} from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Spinner } from "~/components/ui/spinner"
import { inviteFormSchema, type InviteFormValues } from "~/lib/schemas/team"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"

export function InviteMemberDialog() {
  const { t } = useTranslation("team")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const formApi = useRef<FormApi<InviteFormValues>>(null)
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const invitation = useMutation(trpc.team.invite.mutationOptions())
  const roleItems = [
    { label: t("roles.member"), value: "member" },
    { label: t("roles.admin"), value: "admin" },
  ]

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (invitation.isPending) return
        if (nextOpen) {
          setFormKey((key) => key + 1)
          invitation.reset()
        }
        setOpen(nextOpen)
      }}
    >
      <DialogTrigger render={<Button aria-label={t("invite.action")} className="electron-no-drag h-9 rounded-xl max-md:w-9 max-md:px-0" size="lg" type="button" />}>
        <Icon aria-hidden="true" name="add" size={20} />
        <span className="max-md:sr-only">{t("invite.action")}</span>
      </DialogTrigger>
      <DialogPopup className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("invite.title")}</DialogTitle>
          <DialogDescription>{t("invite.description")}</DialogDescription>
        </DialogHeader>
        <AppForm
          key={formKey}
          className="contents"
          defaultValues={{ email: "", role: "member" }}
          ref={formApi}
          schema={inviteFormSchema}
          onBeforeSubmit={() => formApi.current?.unstable_setCustomError("email", null)}
          submitFn={async (values) => {
            try {
              const result = await invitation.mutateAsync(values)
              if (result.error) {
                formApi.current?.unstable_setCustomError("email", t(`invite.${result.error}`))
                return
              }
              setOpen(false)
              toast.success(t("invite.sent"))
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: trpc.team.list.queryKey() }),
                queryClient.invalidateQueries({ queryKey: trpc.team.count.queryKey() }),
              ])
            } catch (error) {
              toast.error(t("invite.failed"))
              throw error
            }
          }}
        >
          {(form) => {
            const roleField = form.getControlProps("role")

            return (
              <>
                <DialogPanel className="flex flex-col gap-4">
                  <FormLabel label={t("email")} error={form.error("email")}>
                    <Input
                      {...form.getInputProps("email")}
                      aria-invalid={Boolean(form.error("email"))}
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      inputMode="email"
                      placeholder={t("invite.placeholder")}
                      spellCheck={false}
                      type="text"
                    />
                  </FormLabel>
                  <FormLabel
                    error={form.error("role")}
                    label={t("role")}
                  >
                    <Select
                      items={roleItems}
                      onValueChange={(value) => {
                        if (value !== "member" && value !== "admin") return
                        roleField.onChange(value)
                        form.unstable_setCustomError("role", null)
                      }}
                      value={roleField.value}
                    >
                      <SelectTrigger
                        aria-invalid={Boolean(form.error("role"))}
                        onBlur={roleField.onBlur}
                        ref={roleField.ref}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectPopup>
                        {roleItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectPopup>
                    </Select>
                  </FormLabel>
                </DialogPanel>
                <DialogFooter>
                  <DialogClose render={<Button type="button" variant="ghost" disabled={form.formState.isSubmitting} />}>
                    {t("cancel")}
                  </DialogClose>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? <Spinner /> : null}
                    {t(form.formState.isSubmitting ? "invite.sending" : "invite.action")}
                  </Button>
                </DialogFooter>
              </>
            )
          }}
        </AppForm>
      </DialogPopup>
    </Dialog>
  )
}
