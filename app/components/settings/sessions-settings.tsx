import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import type { AppIconName } from "~/components/icons"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { SettingsLoading } from "~/components/settings/settings-loading"
import { authClient } from "~/lib/auth/client"
import { isElectron, isReactNativeWebView } from "~/lib/browser/platform"
import { useAppContext } from "~/lib/hooks/use-app-context"
import { formatDateTime } from "~/lib/localization/format-preference"
import { toast } from "~/lib/toast"

function sessionDevice(userAgent: string | null | undefined, appLabels: { desktop: string; mobile: string }) {
  if (!userAgent) return null
  const client: { label: string; icon: AppIconName } | null = isReactNativeWebView(userAgent) ? { label: appLabels.mobile, icon: "deviceMobile" }
    : isElectron(userAgent) ? { label: appLabels.desktop, icon: "deviceLaptop" }
    : /Edg(?:e|A|iOS)?\//.test(userAgent) ? { label: "Edge", icon: "brandEdge" }
    : /(?:OPR|Opera)\//.test(userAgent) ? { label: "Opera", icon: "brandOpera" }
    : /(?:Firefox|FxiOS)\//.test(userAgent) ? { label: "Firefox", icon: "brandFirefox" }
    : /(?:Chrome|CriOS)\//.test(userAgent) ? { label: "Chrome", icon: "brandChrome" }
    : /Safari\//.test(userAgent) ? { label: "Safari", icon: "brandSafari" } : null
  const device = /iPad/.test(userAgent) ? "iPad"
    : /iPhone/.test(userAgent) ? "iPhone"
    : /Android/.test(userAgent) ? "Android"
    : /Windows/.test(userAgent) ? "Windows"
    : /Macintosh|Mac OS X/.test(userAgent) ? "Mac"
    : /Linux/.test(userAgent) ? "Linux" : null
  return { label: [client?.label, device].filter(Boolean).join(" · ") || null, icon: client?.icon ?? "world" }
}

export function SessionsSettings({ active }: { active: boolean }) {
  const { t, i18n } = useTranslation("team")
  const app = useAppContext()
  const queryClient = useQueryClient()
  const queryKey = ["auth", "sessions", app.user?.id] as const
  const sessions = useQuery({
    queryKey,
    enabled: active,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const [list, current] = await Promise.all([authClient.listSessions(), authClient.getSession()])
      if (list.error) throw list.error
      if (current.error) throw current.error
      if (!current.data || !list.data) throw new Error("Session unavailable")
      const currentId = current.data.session.id
      return {
        currentId,
        sessions: [...list.data].sort((a, b) => {
          if (a.id === currentId) return -1
          if (b.id === currentId) return 1
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        }),
      }
    },
  })
  const revoke = useMutation({
    mutationFn: async (target: { token: string } | "others") => {
      const result = target === "others" ? await authClient.revokeOtherSessions() : await authClient.revokeSession(target)
      if (result.error) throw result.error
    },
    onSuccess: async (_, target) => {
      queryClient.setQueryData(queryKey, (data: typeof sessions.data) => data ? {
        ...data,
        sessions: data.sessions.filter((session) => target === "others" ? session.id === data.currentId : session.token !== target.token),
      } : data)
      toast.success(t(target === "others" ? "sessions.othersSignedOut" : "sessions.signedOut"))
      await queryClient.invalidateQueries({ queryKey })
    },
    onError: () => toast.error(t("sessions.signOutError")),
  })
  const formatDate = (date: Date | string) => formatDateTime(date, {
    formatPreference: app.formatPreference ?? "eu",
    language: i18n.resolvedLanguage === "fi" ? "fi" : "en",
    timeZone: app.organizationTimezone,
  })
  const otherSessions = sessions.data?.sessions.filter((session) => session.id !== sessions.data.currentId) ?? []

  return (
    <section aria-label={t("sessions.tab")} className="flex flex-1 flex-col gap-5">
      {sessions.isPending ? <SettingsLoading label={t("sessions.loading")} /> : null}
      {sessions.isError ? (
        <Alert variant="error">
          <AlertTitle>{t("sessions.loadError")}</AlertTitle>
          <AlertDescription>{t("retryDescription")}</AlertDescription>
          <AlertAction><Button disabled={sessions.isFetching} onClick={() => void sessions.refetch()} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction>
        </Alert>
      ) : null}
      {sessions.data && !sessions.isError ? (
        <>
          <ul className="divide-y rounded-xl border">
            {sessions.data.sessions.map((session) => {
              const current = session.id === sessions.data.currentId
              const sessionClient = sessionDevice(session.userAgent, { desktop: t("sessions.desktopApp"), mobile: t("sessions.mobileApp") })
              const device = sessionClient?.label ?? t("sessions.unknownDevice")
              return (
                <li className="flex flex-wrap items-center gap-3 p-4" key={session.id}>
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon aria-hidden={true} name={sessionClient?.icon ?? "world"} size={20} /></div>
                  <div className="grid min-w-0 flex-1 gap-1.5">
                    <div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-medium">{device}</h4>{current ? <Badge variant="secondary">{t("sessions.current")}</Badge> : null}</div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{t("sessions.created", { date: formatDate(session.createdAt) })}</p>
                    {session.ipAddress ? <p className="break-all text-xs text-muted-foreground">{t("sessions.ipAddress", { ip: session.ipAddress })}</p> : null}
                  </div>
                  {!current ? <Button aria-label={t("sessions.signOutDevice", { device })} disabled={revoke.isPending || sessions.isFetching} loading={revoke.isPending && revoke.variables !== "others" && revoke.variables?.token === session.token} onClick={() => revoke.mutate({ token: session.token })} size="sm" type="button" variant="outline">{t("sessions.signOut")}</Button> : null}
                </li>
              )
            })}
          </ul>
          {otherSessions.length > 0 ? <div><Button disabled={revoke.isPending || sessions.isFetching} loading={revoke.isPending && revoke.variables === "others"} onClick={() => revoke.mutate("others")} size="sm" type="button" variant="outline">{t("sessions.signOutOthers")}</Button></div> : <p className="text-sm text-muted-foreground">{t("sessions.noOthers")}</p>}
        </>
      ) : null}
    </section>
  )
}
