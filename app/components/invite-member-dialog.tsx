import type { FormApi } from "@rvf/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { AppForm } from "~/components/app-form"
import FormLabel from "~/components/form-label"
import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import {
  Drawer, DrawerClose, DrawerDescription, DrawerFooter, DrawerHeader,
  DrawerPanel, DrawerPopup, DrawerTitle, DrawerTrigger,
} from "~/components/ui/drawer"
import {
  Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader,
  DialogPanel, DialogPopup, DialogTitle, DialogTrigger,
} from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { Radio, RadioGroup } from "~/components/ui/radio-group"
import { Spinner } from "~/components/ui/spinner"
import { Switch } from "~/components/ui/switch"
import { useMediaQuery } from "~/lib/hooks"
import { inviteFormSchema, type InviteFormValues } from "~/lib/schemas/team"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"

export function InviteMemberDialog() {
  const { t } = useTranslation("team")
  const isMobile = useMediaQuery("max-640px")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const formApi = useRef<FormApi<InviteFormValues>>(null)
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const invitation = useMutation(trpc.team.invite.mutationOptions())
  const roleItems = [
    { label: t("roles.member"), description: t("invite.standardDescription"), value: "member" },
    { label: t("roles.admin"), description: t("invite.adminDescription"), value: "admin" },
  ]
  const Root = isMobile ? Drawer : Dialog
  const Trigger = isMobile ? DrawerTrigger : DialogTrigger
  const Header = isMobile ? DrawerHeader : DialogHeader
  const Title = isMobile ? DrawerTitle : DialogTitle
  const Description = isMobile ? DrawerDescription : DialogDescription
  const Panel = isMobile ? DrawerPanel : DialogPanel
  const Footer = isMobile ? DrawerFooter : DialogFooter
  const Close = isMobile ? DrawerClose : DialogClose

  return (
    <Root
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
      <Trigger render={<Button aria-label={t("invite.action")} className={import.meta.env.VITE_APP_LAYOUT_STYLE === "floating" ? "electron-no-drag h-9 rounded-xl max-md:w-9 max-md:px-0" : "electron-no-drag h-9 rounded-lg before:rounded-[calc(var(--radius-lg)-1px)] max-md:w-9 max-md:px-0"} size="lg" type="button" />}>
        <Icon aria-hidden="true" name="add" size={20} />
        <span className="max-md:sr-only">{t("invite.action")}</span>
      </Trigger>
      <ResponsiveInvitePopup isMobile={isMobile}>
        <Header>
          <Title>{t("invite.title")}</Title>
          <Description>{t("invite.description")}</Description>
        </Header>
        <AppForm
          key={formKey}
          className="contents"
          defaultValues={{ name: "", email: "", role: "member", sendEmail: true }}
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
              toast.success(t(values.sendEmail ? "invite.sent" : "invite.created"))
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
            const sendEmailField = form.getControlProps("sendEmail")

            return (
              <>
                <Panel className="flex flex-col gap-4">
                  <FormLabel error={form.error("name")} label={t("name")}>
                    <Input
                      {...form.getInputProps("name")}
                      aria-invalid={Boolean(form.error("name"))}
                      autoComplete="name"
                      placeholder={t("invite.namePlaceholder")}
                      type="text"
                    />
                  </FormLabel>
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
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1"
                    description={t("invite.sendEmailDescription")}
                    descriptionClassName="col-start-1 row-start-2"
                    error={form.error("sendEmail")}
                    label={t("invite.sendEmail")}
                    labelGroupClassName="col-start-1 row-start-1"
                  >
                    <Switch
                      aria-invalid={Boolean(form.error("sendEmail")) || undefined}
                      checked={sendEmailField.value}
                      className="col-start-2 row-span-2 row-start-1"
                      disabled={form.formState.isSubmitting}
                      name={sendEmailField.name}
                      onBlur={sendEmailField.onBlur}
                      onCheckedChange={(checked) => sendEmailField.onChange(checked)}
                      ref={sendEmailField.ref}
                    />
                  </FormLabel>
                  <FormLabel
                    error={form.error("role")}
                    label={t("permissionLevel")}
                  >
                    <RadioGroup
                      aria-invalid={Boolean(form.error("role")) || undefined}
                      className="w-full gap-2"
                      onBlur={roleField.onBlur}
                      onValueChange={(value) => {
                        if (value !== "member" && value !== "admin") return
                        roleField.onChange(value)
                        form.unstable_setCustomError("role", null)
                      }}
                      inputRef={roleField.ref}
                      value={roleField.value}
                    >
                      {roleItems.map((item) => (
                        <label
                          className="flex w-full cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-background p-3 transition-colors hover:bg-muted/40 has-data-[checked]:border-primary has-data-[checked]:bg-primary/5 has-data-[focus-visible]:ring-2 has-data-[focus-visible]:ring-ring"
                          key={item.value}
                        >
                          <Radio aria-invalid={Boolean(form.error("role")) || undefined} className="mt-0.5" value={item.value} />
                          <span className="grid gap-1">
                            <span className="text-sm font-medium">{item.label}</span>
                            <span className="text-xs leading-4 text-muted-foreground">{item.description}</span>
                          </span>
                        </label>
                      ))}
                    </RadioGroup>
                  </FormLabel>
                </Panel>
                <Footer>
                  <Close render={<Button type="button" variant="ghost" disabled={form.formState.isSubmitting} />}>
                    {t("cancel")}
                  </Close>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? <Spinner /> : null}
                    {t(form.formState.isSubmitting ? "invite.sending" : "invite.action")}
                  </Button>
                </Footer>
              </>
            )
          }}
        </AppForm>
      </ResponsiveInvitePopup>
    </Root>
  )
}

function ResponsiveInvitePopup({ children, isMobile }: {
  children: ReactNode
  isMobile: boolean
}) {
  return isMobile ? (
    <DrawerPopup showBar>
      {children}
    </DrawerPopup>
  ) : (
    <DialogPopup className="sm:max-w-sm">
      {children}
    </DialogPopup>
  )
}
