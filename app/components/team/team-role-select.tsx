import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { PermissionLevelSelect } from "./permission-level-select"
import { useTRPC } from "~/lib/trpc/client"
import { toast } from "~/lib/toast"

export function TeamRoleSelect({ memberId, role }: { memberId: string; role: string }) {
  const { t } = useTranslation("team")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const mutation = useMutation(trpc.team.setRole.mutationOptions({
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries(trpc.team.list.queryFilter()), queryClient.invalidateQueries(trpc.team.getPerson.queryFilter())])
      toast.success(t("people.roleSaved"))
    }, onError: () => toast.error(t("people.roleFailed")),
  }))
  return <PermissionLevelSelect value={role === "admin" ? "admin" : "member"} disabled={mutation.isPending} onValueChange={(value) => mutation.mutate({ memberId, role: value })} />
}
