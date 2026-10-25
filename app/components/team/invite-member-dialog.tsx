import type { FormApi } from "@rvf/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { ReactElement, ReactNode } from "react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { AppForm } from "~/components/forms/app-form"
import FormLabel from "~/components/forms/form-label"
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
import { PermissionLevelSelect } from "~/components/team/permission-level-select"
import { Spinner } from "~/components/ui/spinner"
import { Switch } from "~/components/ui/switch"
import { useMediaQuery } from "~/lib/hooks"
import { inviteFormSchema, type InviteFormValues } from "~/lib/schemas/team"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"

export function InviteMemberDialog({ staffMemberId, name = "", email = "", trigger }: { staffMemberId?: string; name?: string; email?: string; trigger?: ReactElement }) {
  const { t } = useTranslation("team")
  const isMobile = useMediaQuery("max-640px")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const formApi = useRef<FormApi<InviteFormValues>>(null)
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const invitation = useMutation(trpc.team.invite.mutationOptions())
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
      {trigger ? <Trigger render={trigger} /> : <Trigger render={<Button aria-label={t(staffMemberId ? "people.inviteToApp" : "invite.open")} className={import.meta.env.APP_LAYOUT_STYLE === "floating" ? "electron-no-drag h-9 rounded-xl max-md:w-9 max-md:px-0" : "electron-no-drag h-9 rounded-lg before:rounded-[calc(var(--radius-lg)-1px)] max-md:w-9 max-md:px-0"} size="lg" type="button" />}>
        <Icon aria-hidden="true" name="add" size={20} />
        <span className="max-md:sr-only">{t(staffMemberId ? "people.inviteToApp" : "invite.open")}</span>
      </Trigger>}
      <ResponsiveInvitePopup isMobile={isMobile}>
        <Header>
          <Title>{t("invite.title")}</Title>
          <Description>{t("invite.description")}</Description>
        </Header>
        <AppForm
          key={formKey}
          className="contents"
          defaultValues={{ name, email, role: "member", sendEmail: true, staffMemberId }}
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
              await Promise.all([
                queryClient.invalidateQueries(trpc.team.list.queryFilter()),
                queryClient.invalidateQueries(trpc.team.count.queryFilter()),
                queryClient.invalidateQueries(trpc.resourceLimits.getAll.queryFilter()),
                queryClient.invalidateQueries(trpc.team.getPerson.queryFilter()),
                queryClient.invalidateQueries(trpc.staff.list.queryFilter()),
              ])
              setOpen(false)
              toast.success(t(result.linked ? "people.accessLinked" : staffMemberId && values.sendEmail ? "people.inviteQueued" : values.sendEmail ? "invite.sent" : "invite.created"))
            } catch (error) {
              const appCode = (error as { data?: { appCode?: string } }).data?.appCode
              if (appCode === "RESOURCE_LIMIT_REACHED") {
                const limit = (error as { data?: { resourceLimit?: { limit: number } } }).data?.resourceLimit?.limit
                toast.error(t("common:settings.teamMemberLimitReached", { count: limit }))
              } else if (appCode && ["alreadyMember", "alreadyInvited", "alreadyLinked", "staffEmailMismatch"].includes(appCode)) formApi.current?.unstable_setCustomError("email", t(appCode === "alreadyLinked" ? "people.alreadyLinked" : appCode === "staffEmailMismatch" ? "people.staffEmailMismatch" : `invite.${appCode}`))
              else toast.error(t("invite.failed"))
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
                      autoComplete="off"
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
                    description={t(sendEmailField.value
                      ? "invite.sendEmailOnDescription"
                      : "invite.sendEmailOffDescription")}
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
                    <PermissionLevelSelect
                      name={roleField.name}
                      value={roleField.value}
                      disabled={form.formState.isSubmitting}
                      invalid={Boolean(form.error("role"))}
                      onBlur={roleField.onBlur}
                      ref={roleField.ref}
                      onValueChange={(value) => {
                        roleField.onChange(value)
                        form.unstable_setCustomError("role", null)
                      }}
                    />
                  </FormLabel>
                </Panel>
                <Footer>
                  <Close render={<Button type="button" variant="ghost" disabled={form.formState.isSubmitting} />}>
                    {t("cancel")}
                  </Close>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? <Spinner /> : null}
                    {t(form.formState.isSubmitting
                      ? sendEmailField.value ? "invite.sending" : "invite.creating"
                      : sendEmailField.value ? "invite.action" : "invite.createAction")}
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
    <DrawerPopup forceBackdrop={true} showBar={true}>
      {children}
    </DrawerPopup>
  ) : (
    <DialogPopup forceBackdrop={true} className="sm:max-w-sm">
      {children}
    </DialogPopup>
  )
}
