import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useNavigation } from "react-router"

import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"

type CreateFormButtonProps = {
  className?: string
  compactOnMobile?: boolean
  iconOnly?: boolean
  size?: "default" | "lg"
}

export function CreateFormButton({
  className,
  compactOnMobile = false,
  iconOnly = false,
  size = "default",
}: CreateFormButtonProps) {
  const { t } = useTranslation("forms")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const navigation = useNavigation()
  const [createdFormId, setCreatedFormId] = useState<string | null>(null)
  const createForm = useMutation(trpc.forms.create.mutationOptions({
    onSuccess: async (form) => {
      await Promise.all([
        queryClient.invalidateQueries(trpc.forms.list.queryFilter()),
        queryClient.invalidateQueries(trpc.forms.count.queryFilter()),
        queryClient.invalidateQueries(trpc.forms.overview.queryFilter()),
      ])
      setCreatedFormId(form.id)
      void navigate(`/forms/${form.id}/edit`)
    },
    onError: () => toast.error(t("errors.create")),
  }))
  const isOpeningForm = createdFormId !== null
    && navigation.state !== "idle"
    && navigation.location?.pathname === `/forms/${createdFormId}/edit`

  return (
    <Button
      aria-label={t("create")}
      className={className}
      loading={createForm.isPending || isOpeningForm}
      onClick={() => createForm.mutate()}
      size={size}
      type="button"
    >
      <Icon aria-hidden="true" name="add" size={compactOnMobile ? 20 : 16} />
      <span className={iconOnly ? "sr-only" : compactOnMobile ? "max-md:sr-only" : undefined}>
        {t("create")}
      </span>
    </Button>
  )
}
