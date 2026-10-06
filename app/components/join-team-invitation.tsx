import { useMutation } from "@tanstack/react-query"
import { TRPCClientError } from "@trpc/client"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import { Spinner } from "~/components/ui/spinner"
import { joinedTeamErrorStorageKey, joinedTeamStorageKey } from "~/lib/team-join"
import { useTRPC } from "~/lib/trpc/client"

export function JoinTeamInvitation({ invitationId }: { invitationId: string }) {
  const { t } = useTranslation("team")
  const trpc = useTRPC()
  const started = useRef<string | null>(null)
  const invitation = useMutation(trpc.team.acceptInvitation.mutationOptions({
    retry: false,
    onSuccess: (result) => {
      if (result.error || !result.organizationName) {
        window.sessionStorage.setItem(joinedTeamErrorStorageKey, result.error ?? "unexpected")
      } else {
        window.sessionStorage.setItem(joinedTeamStorageKey, result.organizationName)
      }

      // Reload the app state for the selected organization and clear the invite URL.
      window.location.replace("/")
    },
    onError: (error) => {
      if (error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED") {
        window.location.replace(`/auth?invite=${encodeURIComponent(invitationId ?? "")}`)
        return
      }

      window.sessionStorage.setItem(joinedTeamErrorStorageKey, "unexpected")
      window.location.replace("/")
    },
  }))

  useEffect(() => {
    if (!invitationId || started.current === invitationId) return

    started.current = invitationId
    invitation.mutate({ invitationId })
  }, [invitationId, invitation.mutate])

  return (
    <main aria-busy={true} className="grid min-h-dvh place-items-center bg-background px-6" role="status">
      <div className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 text-base text-muted-foreground">
        <Spinner aria-hidden={true} className="size-5 text-primary" />
        <span>{t("accept.checking")}</span>
      </div>
    </main>
  )
}
