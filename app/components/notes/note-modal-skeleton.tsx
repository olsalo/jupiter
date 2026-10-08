import { useTranslation } from "react-i18next"

import FormLabel from "~/components/form-label"
import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Skeleton } from "~/components/ui/skeleton"
import { ResponsiveSheetDescription, ResponsiveSheetFooter, ResponsiveSheetHeader, ResponsiveSheetPanel, ResponsiveSheetTitle } from "~/components/responsive-sheet"

export function NoteModalSkeleton({ descriptionId, isEditing, titleId }: { descriptionId: string, isEditing: boolean, titleId: string }) {
  const { t } = useTranslation("notes")

  return (
    <>
      <ResponsiveSheetHeader>
        {isEditing ? (
          <ResponsiveSheetTitle id={titleId}>{t("form.editTitle")}</ResponsiveSheetTitle>
        ) : (
          <>
            <ResponsiveSheetTitle className="sr-only" id={titleId}>{t("view.loading")}</ResponsiveSheetTitle>
            <Skeleton aria-hidden={true} className="h-5 w-2/3" />
          </>
        )}
        <ResponsiveSheetDescription id={descriptionId}>{isEditing ? t("description") : t("view.description")}</ResponsiveSheetDescription>
      </ResponsiveSheetHeader>
      <ResponsiveSheetPanel
        aria-busy={true}
        aria-label={t("view.loading")}
        className={isEditing ? undefined : "flex min-h-0 flex-1 flex-col gap-6"}
        role="status"
      >
        {isEditing ? (
          <div aria-hidden={true} className="flex w-full flex-col gap-5">
            <FormLabel label={t("form.title.label")}>
              <Skeleton className="h-9 w-full rounded-lg sm:h-8" />
            </FormLabel>
            <FormLabel label={t("form.body.label")}>
              <Skeleton className="h-21 w-full rounded-lg sm:h-18" />
            </FormLabel>
          </div>
        ) : (
          <>
            <div aria-hidden={true} className="flex flex-col gap-2">
              <span className="text-sm font-medium text-muted-foreground">{t("form.body.label")}</span>
              <div className="flex flex-col">
                <div className="flex h-5 items-center"><Skeleton className="h-3.5 w-full" /></div>
                <div className="flex h-5 items-center"><Skeleton className="h-3.5 w-5/6" /></div>
                <div className="flex h-5 items-center"><Skeleton className="h-3.5 w-2/3" /></div>
              </div>
            </div>
            <dl aria-hidden={true} className="grid gap-3 border-t border-border/60 pt-4 text-sm">
              {["created", "updated"].map((label) => (
                <div className="flex h-5 items-center justify-between gap-4" key={label}>
                  <dt className="text-muted-foreground">{t(`labels.${label}`)}</dt>
                  <dd className="flex justify-end"><Skeleton className="h-3.5 w-36" /></dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </ResponsiveSheetPanel>
      <ResponsiveSheetFooter>
        {isEditing ? (
          <>
            <Button disabled={true} type="button" variant="ghost">{t("form.cancel")}</Button>
            <Button disabled={true} type="button">{t("form.save")}</Button>
          </>
        ) : (
          <Button disabled={true} type="button">
            <Icon aria-hidden={true} name="edit" size={16} />
            {t("actions.edit")}
          </Button>
        )}
      </ResponsiveSheetFooter>
    </>
  )
}

