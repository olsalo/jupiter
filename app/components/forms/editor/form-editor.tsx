import { DragDropProvider } from "@dnd-kit/react"
import { isSortable } from "@dnd-kit/react/sortable"
import { Feedback } from "@dnd-kit/dom"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { FormPreview } from "./form-preview"
import { FormHeadingEditor } from "./form-heading-editor"
import { FormItemEditor } from "./form-item-editor"
import { SortableItemCard } from "./sortable-item-card"
import { useFormEditorDraft } from "./use-form-editor-draft"
import Icon from "~/components/icons"
import { Alert, AlertAction, AlertDescription } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Spinner } from "~/components/ui/spinner"
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"

export function FormEditor({ formId }: { formId: string }) {
  const { t } = useTranslation("forms")
  const {
    draft,
    editorSession,
    hasConflict,
    reloadDraft,
    cards,
    activeId,
    saveStatus,
    isReady,
    loadError,
    retryLoad,
    setActiveId,
    updateHeading,
    updateLocalItem,
    updateTextBlock,
    updateItemType,
    addItem,
    duplicateCard,
    removeCard,
    reorderCards,
  } = useFormEditorDraft(formId)
  const [view, setView] = useState<"edit" | "preview">("edit")
  const [pressedTool, setPressedTool] = useState<"question" | "text" | null>(null)
  const cardListRef = useRef<HTMLDivElement>(null)
  const isEmpty = isReady && draft !== null && cards.length === 0

  const selectView = (nextView: "edit" | "preview") => {
    setView(nextView)
    setActiveId(null)
  }

  useEffect(() => {
    const clearActiveCard = (event: Event) => {
      if (
        event.target instanceof Element &&
        event.target.closest("[data-form-input-card], [data-form-tools]")
      ) return
      setActiveId(null)
    }

    document.addEventListener("pointerdown", clearActiveCard)
    document.addEventListener("focusin", clearActiveCard)
    return () => {
      document.removeEventListener("pointerdown", clearActiveCard)
      document.removeEventListener("focusin", clearActiveCard)
    }
  }, [])

  return (
    <div className="relative isolate min-h-0 flex-1 overflow-hidden bg-neutral-50 dark:bg-background">
      {view === "edit" ? (
        <>
          <DragDropProvider
            plugins={(defaults) => [
              ...defaults,
              Feedback.configure({ dropAnimation: null }),
            ]}
            onDragEnd={(event) => {
              if (event.canceled) return
              const { source } = event.operation
              if (!isSortable(source) || source.initialIndex === source.index) return

              reorderCards(source.initialIndex, source.index)
            }}
          >
            <ScrollArea
              className={cn(
                "relative z-0 h-full overflow-clip [&_[data-slot=scroll-area-scrollbar]]:hidden",
                isEmpty && "[&_[data-slot=scroll-area-content]]:flex [&_[data-slot=scroll-area-content]]:min-h-full",
              )}
              data-form-editor-scroll-area=""
              scrollFade={true}
            >
            <div className={cn("mx-auto w-full max-w-172 px-6 pt-4 pb-20 md:pb-4", isEmpty && "flex flex-1 flex-col")}>
              <div className={cn("flex flex-col gap-4", isEmpty && "flex-1")}>
                {!isReady && loadError ? (
                  <Alert variant="error">
                    <AlertDescription>{t("errors.load")}</AlertDescription>
                    <AlertAction>
                      <Button onClick={() => { void retryLoad() }} size="sm" type="button" variant="outline">
                        {t("retry")}
                      </Button>
                    </AlertAction>
                  </Alert>
                ) : isReady && saveStatus === "error" ? (
                  <Alert variant="error">
                    <AlertDescription>{t(hasConflict ? "workspace.conflict" : "workspace.saveError")}</AlertDescription>
                    {hasConflict ? <AlertAction><Button onClick={() => { void reloadDraft() }} size="sm" type="button" variant="outline">{t("workspace.reloadDraft")}</Button></AlertAction> : null}
                  </Alert>
                ) : null}
                <fieldset className="contents" disabled={hasConflict}>
                {draft ? (
                  <div
                    className={cn("relative rounded-xl border border-border bg-background p-4 shadow-xs", activeId === `heading-${formId}` && "border-foreground/20")}
                    data-form-input-card=""
                    onFocusCapture={() => setActiveId(`heading-${formId}`)}
                    onPointerDownCapture={() => setActiveId(`heading-${formId}`)}
                  >
                    <FormHeadingEditor
                      description={draft.description}
                      formId={formId}
                      key={`heading-${formId}:${editorSession}`}
                      onChange={updateHeading}
                      title={draft.title}
                    />
                  </div>
                ) : null}
                <div className={cn("flex flex-col gap-4", isEmpty && "flex-1")} ref={cardListRef}>
                  {isEmpty ? (
                    <Empty className="min-h-64">
                      <EmptyHeader>
                        <EmptyMedia variant="icon"><Icon aria-hidden={true} name="forms" size={20} /></EmptyMedia>
                        <EmptyTitle>{t("workspace.emptyTitle")}</EmptyTitle>
                        <EmptyDescription>{t("workspace.emptyDescription")}</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : null}
                  {cards.map((card, index) => {
                    const questionNumber = cards.slice(0, index + 1).filter((item) => item.type !== "TEXT_BLOCK").length
                    const label = card.label || (card.type === "TEXT_BLOCK"
                      ? t("workspace.textBlock")
                      : t("workspace.question", { number: questionNumber }))

                    return (
                      <SortableItemCard
                        active={activeId === card.id}
                        containerRef={cardListRef}
                        id={card.id}
                        index={index}
                        key={`${card.id}:${editorSession}`}
                        label={label}
                        onActivate={setActiveId}
                      >
                        <FormItemEditor
                          item={card}
                          formId={formId}
                          onChange={(values) => {
                            if ("required" in values) updateLocalItem(card.id, values)
                            else updateTextBlock(card.id, values)
                          }}
                          onTypeChange={(type) => updateItemType(card, type)}
                          onDelete={() => removeCard(card)}
                          onDuplicate={() => duplicateCard(card)}
                        />
                      </SortableItemCard>
                    )
                  })}
                </div>
                </fieldset>
              </div>
            </div>
            </ScrollArea>
          </DragDropProvider>
          {!isReady && !loadError ? (
            <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
              <Spinner aria-label={t("loading")} className="size-6 text-muted-foreground" />
            </div>
          ) : null}
        </>
      ) : (
        <FormPreview draft={draft} />
      )}

      {view === "edit" ? (
        <div aria-label={t("workspace.tools")} className="absolute bottom-4 left-4 z-20 flex items-center gap-1 rounded-full border border-border bg-background p-1 shadow-sm md:top-1/2 md:bottom-auto md:-translate-y-1/2 md:flex-col" data-form-tools="" role="toolbar">
          <TooltipProvider delay={0}>
            <Tooltip>
              <TooltipTrigger
                delay={0}
                render={
                  <button
                    aria-label={t("workspace.addQuestion")}
                    className={cn(
                      "flex size-9 touch-manipulation items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground active:bg-muted active:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                      pressedTool === "question" && "bg-muted text-foreground",
                    )}
                    onPointerCancel={() => setPressedTool(null)}
                    onPointerDown={() => setPressedTool("question")}
                    onPointerLeave={() => setPressedTool(null)}
                    onPointerUp={() => setPressedTool(null)}
                    onClick={() => addItem()}
                    disabled={!isReady || hasConflict}
                    type="button"
                  >
                    <Icon aria-hidden={true} name="plus" size={20} />
                  </button>
                }
              />
              <TooltipPopup side="right" sideOffset={8}>
                {t("workspace.addQuestion")}
              </TooltipPopup>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                delay={0}
                render={
                  <button
                    aria-label={t("workspace.addText")}
                    className={cn(
                      "flex size-9 touch-manipulation items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground active:bg-muted active:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                      pressedTool === "text" && "bg-muted text-foreground",
                    )}
                    onPointerCancel={() => setPressedTool(null)}
                    onPointerDown={() => setPressedTool("text")}
                    onPointerLeave={() => setPressedTool(null)}
                    onPointerUp={() => setPressedTool(null)}
                    onClick={() => addItem("TEXT_BLOCK")}
                    disabled={!isReady || hasConflict}
                    type="button"
                  >
                    <Icon aria-hidden={true} name="textSize" size={20} />
                  </button>
                }
              />
              <TooltipPopup side="right" sideOffset={8}>
                {t("workspace.addText")}
              </TooltipPopup>
            </Tooltip>
          </TooltipProvider>
        </div>
      ) : null}

      <nav aria-label={t("workspace.views")} className="absolute bottom-4 right-4 z-20 flex items-center gap-1 rounded-full border border-border bg-background p-1 shadow-sm">
        {(["edit", "preview"] as const).map((item) => (
          <button
            aria-pressed={view === item}
            className={cn(
              "flex h-9 touch-manipulation items-center justify-center rounded-full px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              view === item
                ? "bg-foreground text-background active:bg-foreground/90"
                : "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted active:text-foreground",
            )}
            key={item}
            onClick={() => selectView(item)}
            onTouchEnd={() => selectView(item)}
            type="button"
          >
            {t(`workspace.${item}`)}
          </button>
        ))}
      </nav>
    </div>
  )
}
