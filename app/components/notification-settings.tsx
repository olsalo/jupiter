import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { FormApi } from "@rvf/react"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useRouteLoaderData } from "react-router"

import { AppForm } from "~/components/app-form"
import FormLabel from "~/components/form-label"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Switch } from "~/components/ui/switch"
import { notificationSettingsSchema, type NotificationSettingsInput } from "~/lib/schemas/notifications"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"
import { useBackgroundSetting } from "~/lib/use-background-setting"
import type { loader as rootLoader } from "~/root"

export function NotificationSettings({ onLoadingChange }: { onLoadingChange: (isLoading: boolean) => void }) {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const settings = useQuery(trpc.profile.notifications.queryOptions())
  useEffect(() => {
    onLoadingChange(settings.isLoading)
    return () => onLoadingChange(false)
  }, [onLoadingChange, settings.isLoading])

  if (settings.isError) {
    return <Alert variant="error"><AlertDescription>{t("settings.loadError")}</AlertDescription></Alert>
  }

  if (!settings.data) {
    return null
  }

  return <NotificationSettingsForm initialValues={settings.data} />
}

function NotificationSettingsForm({ initialValues }: { initialValues: NotificationSettingsInput }) {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const formApi = useRef<FormApi<NotificationSettingsInput>>(null)
  const setting = useBackgroundSetting(`${rootData?.user?.id}:newResponseEmail`, initialValues.newResponseEmail)
  const mutation = useMutation(trpc.profile.updateNotifications.mutationOptions())
  const save = (newResponseEmail: boolean) => setting.set(newResponseEmail, async () => {
    const data = await mutation.mutateAsync({ newResponseEmail })
    queryClient.setQueryData(trpc.profile.notifications.queryKey(), data)
  }, () => toast.error(t("settings.notificationSaveError")))

  return (
    <AppForm<NotificationSettingsInput, NotificationSettingsInput, NotificationSettingsInput>
      defaultValues={initialValues}
      ref={formApi}
      schema={notificationSettingsSchema}
      submitFn={async (input) => {
        await save(input.newResponseEmail)
        return input
      }}
    >
      {(form) => {
        const field = form.getControlProps("newResponseEmail")
        return (
          <FormLabel
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1"
            description={t("settings.newResponseEmailDescription")}
            descriptionClassName="col-start-1 row-start-2"
            error={form.error("newResponseEmail")}
            label={t("settings.newResponseEmail")}
            labelGroupClassName="col-start-1 row-start-1"
          >
            <Switch
              aria-invalid={Boolean(form.error("newResponseEmail"))}
              checked={setting.value}
              className="col-start-2 row-span-2 row-start-1"
              disabled={false}
              name={field.name}
              onBlur={field.onBlur}
              onCheckedChange={(checked) => {
                field.onChange(checked)
                void save(checked)
              }}
              ref={field.ref}
            />
          </FormLabel>
        )
      }}
    </AppForm>
  )
}
