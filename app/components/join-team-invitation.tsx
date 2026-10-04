import { useMutation } from "@tanstack/react-query"
import { TRPCClientError } from "@trpc/client"
import { useEffect, useRef } from "react"
import { useSearchParams } from "react-router"

import { joinInvitationSearchParam, joinedTeamErrorStorageKey, joinedTeamStorageKey } from "~/lib/team-join"
import { useTRPC } from "~/lib/trpc/client"

export function JoinTeamInvitation() {
  const trpc = useTRPC()
  const [searchParams] = useSearchParams()
  const invitationId = searchParams.get(joinInvitationSearchParam)
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
      if (error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED") return

      window.sessionStorage.setItem(joinedTeamErrorStorageKey, "unexpected")
      window.location.replace("/")
    },
  }))

  useEffect(() => {
    if (!invitationId || started.current === invitationId) return

    started.current = invitationId
    invitation.mutate({ invitationId })
  }, [invitationId, invitation.mutate])

  return null
}
