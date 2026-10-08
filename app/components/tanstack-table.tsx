import {
  createPaginatedRowModel,
  rowPaginationFeature,
  rowSelectionFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type RowSelectionState,
} from "@tanstack/react-table"
import type { ComponentProps, CSSProperties, KeyboardEvent, MouseEvent, ReactNode, UIEvent } from "react"
import { useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"

import Icon, { type AppIconName } from "~/components/icons"
import { Skeleton } from "~/components/ui/skeleton"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "~/components/ui/pagination"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/lib/utils"

type TanStackTableColumnMeta = {
  width?: CSSProperties["width"]
  minWidth?: CSSProperties["minWidth"]
  grow?: number
  align?: "start" | "center" | "end"
  headerClassName?: string
  cellClassName?: string
  isAction?: boolean
  mobileActionPlacement?: "top-right"
  skeleton?: "text" | "textLines" | "avatarText" | "badge" | "actions"
}

export const tanStackTableFeatures = tableFeatures({
  rowPaginationFeature,
  rowSelectionFeature,
  paginatedRowModel: createPaginatedRowModel(),
  columnMeta: {} as TanStackTableColumnMeta,
})

export type TanStackTableColumn<Row extends RowData> = ColumnDef<
  typeof tanStackTableFeatures,
  Row
>

export type TanStackTableSelectionContext<Row extends RowData> = {
  selectedRows: readonly Row[]
  selectedRowIds: readonly string[]
  clearSelection: () => void
}

export type TanStackTableSelectionAction<Row extends RowData> = {
  id: string
  label: ReactNode
  icon?: AppIconName
  onClick: (context: TanStackTableSelectionContext<Row>) => void
  disabled?: boolean
  loading?: boolean
  variant?: ComponentProps<typeof Button>["variant"]
}

export type TanStackTableMultiSelect<Row extends RowData> = {
  actions?: readonly TanStackTableSelectionAction<Row>[]
  clearSelectionLabel: string
  getRowLabel: (row: Row) => string
  selectedLabel: (count: number) => ReactNode
  selectAllLabel: string
  toolbarLabel: string
  isRowDisabled?: (row: Row) => boolean
}

export type TanStackTablePagination = {
  ariaLabel: string
  nextLabel: string
  pageLabel: (page: number) => string
  pageSize?: number
  previousLabel: string
}

export type TanStackTableSubtable<Row extends RowData> = {
  ariaLabel: (row: Row) => string
  defaultExpanded?: boolean | ((row: Row) => boolean)
  render: (row: Row) => ReactNode
}

export type TanStackTableProps<Row extends RowData> = {
  ariaLabel: string
  columns: readonly TanStackTableColumn<Row>[]
  data: readonly Row[]
  getRowId: (row: Row) => string
  emptyContent?: ReactNode
  emptyContainerClassName?: string
  fillHeight?: boolean
  fixedSelectionToolbar?: boolean
  loading?: boolean
  loadingLabel?: string
  loadingVariant?: "spinner" | "skeleton"
  skeletonRowCount?: number
  className?: string
  enableMultiSelect?: boolean
  enablePagination?: boolean
  multiSelect?: TanStackTableMultiSelect<Row>
  onSelectedRowIdsChange?: (selectedRowIds: readonly string[]) => void
  pagination?: TanStackTablePagination
  onRowClick?: (row: Row) => void
  isRowClickable?: (row: Row) => boolean
  rowClassName?: string | ((row: Row) => string | undefined)
  rowDividers?: boolean
  renderSelectionToolbar?: boolean
  scrollResetKey?: number
  selectedRowIds?: readonly string[]
  subtable?: TanStackTableSubtable<Row>
}

const alignmentClasses = {
  start: "justify-start text-left",
  center: "justify-center text-center",
  end: "justify-end text-right",
}

export function TanStackTable<Row extends RowData>({
  ariaLabel,
  className,
  columns,
  data,
  emptyContent,
  emptyContainerClassName = "border-0 bg-transparent shadow-none",
  fillHeight = false,
  fixedSelectionToolbar = false,
  enableMultiSelect = true,
  enablePagination = true,
  getRowId,
  isRowClickable,
  loading = false,
  loadingLabel,
  loadingVariant,
  skeletonRowCount,
  multiSelect,
  onRowClick,
  onSelectedRowIdsChange,
  pagination,
  rowClassName,
  rowDividers = true,
  renderSelectionToolbar = true,
  scrollResetKey,
  selectedRowIds: controlledSelectedRowIds,
  subtable,
}: TanStackTableProps<Row>) {
  const { t } = useTranslation("common")
  const headerTrackRef = useRef<HTMLDivElement>(null)
  const [showLeftFade, setShowLeftFade] = useState(false)
  const [showRightFade, setShowRightFade] = useState(false)
  const [showTopFade, setShowTopFade] = useState(false)
  const [showBottomFade, setShowBottomFade] = useState(false)
  const [horizontalScrollbarWidth, setHorizontalScrollbarWidth] = useState(0)
  const [expandedRowIds, setExpandedRowIds] = useState<Record<string, boolean>>({})
  const [bodyPortalTarget, setBodyPortalTarget] = useState<HTMLElement | null>(null)
  const scrollPositionRef = useRef({ left: 0, top: 0 })
  const scrollResetKeyRef = useRef(scrollResetKey)
  const horizontalScrollbarRef = useRef<HTMLDivElement>(null)
  const scrollViewportRef = useRef<HTMLDivElement>(null)
  const isMultiSelectEnabled = enableMultiSelect && Boolean(multiSelect)
  const isPaginationEnabled = enablePagination && Boolean(pagination)
  const externalRowSelection: RowSelectionState | undefined = controlledSelectedRowIds
    ? Object.fromEntries(controlledSelectedRowIds.map((rowId) => [rowId, true])) as RowSelectionState
    : undefined
  const selectionColumn: TanStackTableColumn<Row> | undefined =
    isMultiSelectEnabled && multiSelect
    ? {
        id: "__row-selection",
        header: ({ table }) => {
          const allRowsSelected = table.getIsAllRowsSelected()

          return (
            <Checkbox
              aria-label={multiSelect.selectAllLabel}
              checked={allRowsSelected}
              className="size-5 cursor-default sm:size-5 [&_svg]:size-4"
              indeterminate={
                table.getIsSomeRowsSelected() && !allRowsSelected
              }
              onCheckedChange={(checked) =>
                table.toggleAllRowsSelected(checked)
              }
            />
          )
        },
        cell: ({ row }) => (
          <Checkbox
            aria-label={multiSelect.getRowLabel(row.original)}
            checked={row.getIsSelected()}
            className="size-5 cursor-default sm:size-5 [&_svg]:size-4"
            disabled={!row.getCanSelect()}
            indeterminate={row.getIsSomeSelected()}
            onCheckedChange={(checked) => row.toggleSelected(checked)}
          />
        ),
        meta: {
          align: "center",
          width: "3rem",
        },
      }
    : undefined
  const subtableColumn: TanStackTableColumn<Row> | undefined = subtable
    ? {
        id: "__subtable-toggle",
        header: () => <span className="sr-only">{t("table.showDetails")}</span>,
        cell: ({ row }) => {
          const isExpanded = expandedRowIds[row.id] ?? getDefaultExpanded(subtable, row.original)

          return (
            <Button
              aria-expanded={isExpanded}
              aria-label={t(isExpanded ? "table.hideRowDetails" : "table.showRowDetails", { name: subtable.ariaLabel(row.original) })}
              onClick={(event) => {
                event.stopPropagation()
                setExpandedRowIds((rows) => ({ ...rows, [row.id]: !isExpanded }))
              }}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              <Icon aria-hidden="true" className={cn("transition-transform", isExpanded && "rotate-180")} name="chevronDown" size={16} />
            </Button>
          )
        },
        meta: { align: "center", width: "3rem" },
      }
    : undefined
  const resolvedColumns = selectionColumn
    ? [subtableColumn, selectionColumn, ...columns].filter(Boolean) as TanStackTableColumn<Row>[]
    : [subtableColumn, ...columns].filter(Boolean) as TanStackTableColumn<Row>[]
  const table = useTable({
    features: tanStackTableFeatures,
    columns: resolvedColumns,
    data,
    enableMultiRowSelection: isMultiSelectEnabled,
    enableRowSelection: isMultiSelectEnabled && multiSelect
      ? (row) => !multiSelect.isRowDisabled?.(row.original)
      : false,
    getRowId,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: Math.max(1, pagination?.pageSize ?? 10),
      },
    },
    manualPagination: !isPaginationEnabled,
    ...(externalRowSelection && onSelectedRowIdsChange ? {
      onRowSelectionChange: (updater) => {
        const nextSelection = typeof updater === "function" ? updater(externalRowSelection) : updater
        onSelectedRowIdsChange(Object.keys(nextSelection).filter((rowId) => nextSelection[rowId]))
      },
      state: { rowSelection: externalRowSelection },
    } : {}),
  })
  const headerGroups = table.getHeaderGroups()
  const mobileHeaders = headerGroups[headerGroups.length - 1]?.headers ?? []
  const rows = table.getRowModel().rows
  const hasRows = !loading && rows.length > 0
  const showSkeleton = loading && loadingVariant !== "spinner" &&
    skeletonRowCount !== undefined && Number.isFinite(skeletonRowCount) && skeletonRowCount > 0
  const showSpinner = loading && !showSkeleton
  const hasVisualRows = hasRows || showSkeleton
  const skeletonRows = Array.from(
    { length: showSkeleton ? Math.max(1, Math.floor(skeletonRowCount)) : 0 },
    (_, index) => index,
  )
  const pageCount = isPaginationEnabled ? table.getPageCount() : 0
  const pageIndex = table.state.pagination.pageIndex
  const pageSize = table.state.pagination.pageSize
  const paginationItems = isPaginationEnabled
    ? getPaginationItems(pageIndex, pageCount)
    : []
  const selectedRowIds = isMultiSelectEnabled
    ? Object.entries(table.state.rowSelection)
        .filter(([, selected]) => selected)
        .map(([rowId]) => rowId)
    : []
  const selectedRows = isMultiSelectEnabled
    ? table.getSelectedRowModel().flatRows.map((row) => row.original)
    : []
  const selectionContext: TanStackTableSelectionContext<Row> = {
    selectedRows,
    selectedRowIds,
    clearSelection: () => onSelectedRowIdsChange ? onSelectedRowIdsChange([]) : table.resetRowSelection(true),
  }
  const leafColumns = table.getAllLeafColumns()
  const columnCount = leafColumns.length
  const hasMobileTopRightAction = leafColumns.some((column) =>
    column.columnDef.meta?.isAction === true && column.columnDef.meta?.mobileActionPlacement === "top-right",
  )
  const rowGridStyle = getRowGridStyle(
    leafColumns.map((column) => column.columnDef.meta),
  )

  useLayoutEffect(() => {
    setBodyPortalTarget(document.body)
  }, [])

  useLayoutEffect(() => {
    const viewport = scrollViewportRef.current

    if (!viewport) {
      return
    }

    const updateFades = () => {
      updateHorizontalFades(viewport)
      updateVerticalFades(viewport)
      setHorizontalScrollbarWidth(
        viewport.scrollWidth > viewport.clientWidth + 1
          ? viewport.scrollWidth
          : 0,
      )
    }
    const resizeObserver = new ResizeObserver(updateFades)

    resizeObserver.observe(viewport)

    if (scrollResetKey !== scrollResetKeyRef.current) {
      scrollResetKeyRef.current = scrollResetKey
      scrollPositionRef.current = { left: 0, top: 0 }
      viewport.scrollTo(scrollPositionRef.current)
      updateFades()

      return () => resizeObserver.disconnect()
    }

    const restoreScrollPosition = () => {
      viewport.scrollTo(scrollPositionRef.current)
      updateFades()
    }

    restoreScrollPosition()
    const animationFrame = requestAnimationFrame(restoreScrollPosition)

    return () => {
      cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
    }
  }, [data, scrollResetKey])

  useLayoutEffect(() => {
    if (!isMultiSelectEnabled) {
      return
    }

    const rowIds = new Set(data.map((row) => getRowId(row)))
    const staleRowIds = Object.keys(table.state.rowSelection).filter(
      (rowId) => table.state.rowSelection[rowId] && !rowIds.has(rowId),
    )

    if (staleRowIds.length === 0) {
      return
    }

    table.setRowSelection((currentSelection) => {
      const nextSelection = { ...currentSelection }

      for (const rowId of staleRowIds) {
        delete nextSelection[rowId]
      }

      return nextSelection
    })
  }, [data, getRowId, isMultiSelectEnabled, table])

  function syncHorizontalScroll(left: number) {
    if (headerTrackRef.current) {
      headerTrackRef.current.style.transform = `translate3d(${-left}px, 0, 0)`
    }

    if (horizontalScrollbarRef.current) {
      horizontalScrollbarRef.current.scrollLeft = left
    }
  }

  function updateHorizontalFades(viewport: HTMLDivElement) {
    setShowLeftFade(viewport.scrollLeft > 0)
    setShowRightFade(
      viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 1,
    )
  }

  function updateVerticalFades(viewport: HTMLDivElement) {
    const remaining = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop

    setShowTopFade(viewport.scrollTop > 0)
    setShowBottomFade(remaining > 1)
  }

  function syncTableScroll(event: UIEvent<HTMLDivElement>) {
    scrollPositionRef.current = {
      left: event.currentTarget.scrollLeft,
      top: event.currentTarget.scrollTop,
    }
    syncHorizontalScroll(event.currentTarget.scrollLeft)
    updateHorizontalFades(event.currentTarget)
    updateVerticalFades(event.currentTarget)
  }

  function syncScrollbarScroll(event: UIEvent<HTMLDivElement>) {
    const viewport = scrollViewportRef.current

    if (!viewport) {
      return
    }

    viewport.scrollLeft = event.currentTarget.scrollLeft
    scrollPositionRef.current.left = event.currentTarget.scrollLeft
    syncHorizontalScroll(event.currentTarget.scrollLeft)
    updateHorizontalFades(viewport)
  }

  function goToPage(nextPageIndex: number) {
    const viewport = scrollViewportRef.current

    scrollPositionRef.current.top = 0
    viewport?.scrollTo({ left: scrollPositionRef.current.left, top: 0 })
    table.setPageIndex(nextPageIndex)
  }

  function toggleSubtable(rowId: string, isExpanded: boolean) {
    setExpandedRowIds((rows) => ({ ...rows, [rowId]: !isExpanded }))
  }

  const selectionToolbar = renderSelectionToolbar && isMultiSelectEnabled && multiSelect && selectedRowIds.length > 0 ? (
    <div
      className={cn(
        "pointer-events-none inset-x-3 flex justify-center",
        fixedSelectionToolbar
          ? "fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] z-40 md:bottom-10"
          : "absolute z-30 max-md:fixed max-md:bottom-[calc(6rem+env(safe-area-inset-bottom))]",
        !fixedSelectionToolbar && (isPaginationEnabled ? "bottom-18" : "bottom-10"),
      )}
    >
      <div
        aria-label={multiSelect.toolbarLabel}
        className="pointer-events-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-1 rounded-xl bg-black p-1.5 text-white shadow-lg"
        role="toolbar"
      >
        <Button
          aria-label={multiSelect.clearSelectionLabel}
          className="border-transparent bg-transparent text-white hover:bg-white/16 active:bg-white/24"
          onClick={selectionContext.clearSelection}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Icon aria-hidden="true" name="x" />
        </Button>
        <span
          aria-live="polite"
          className="min-w-0 max-w-full truncate px-1 text-sm font-medium"
        >
          {multiSelect.selectedLabel(selectedRowIds.length)}
        </span>
        {multiSelect.actions && multiSelect.actions.length > 0 ? (
          <div
            aria-hidden="true"
            className="mx-1 h-5 w-px bg-white/24"
          />
        ) : null}
        {multiSelect.actions?.map((action) => (
          <Button
            disabled={action.disabled || action.loading}
            key={action.id}
            onClick={() => action.onClick(selectionContext)}
            size="sm"
            type="button"
            variant={action.variant ?? "ghost"}
            className={cn(
              "max-w-full",
              (!action.variant || action.variant === "ghost") &&
                "border-transparent bg-transparent text-white hover:bg-white/16",
            )}
          >
            {action.loading ? (
              <Icon
                aria-hidden="true"
                className="animate-spin"
                name="loader"
              />
            ) : action.icon ? (
              <Icon aria-hidden="true" name={action.icon} />
            ) : null}
            <span className="min-w-0 truncate">{action.label}</span>
          </Button>
        ))}
      </div>
    </div>
  ) : null

  if (!hasVisualRows && !loading && !isPaginationEnabled) {
    return (
      <div
        className={cn(
          "flex min-h-0 min-w-0 w-full flex-1 flex-col",
          !fillHeight && "md:h-auto md:flex-none",
          className,
          "min-h-0 md:min-h-[max(20rem,calc(100dvh-18rem))]",
        )}
      >
        {emptyContent}
      </div>
    )
  }

  if (showSpinner) {
    return (
      <div
        aria-label={loadingLabel}
        className={cn(
          "flex min-h-0 min-w-0 w-full flex-1 items-center justify-center",
          !fillHeight && "md:h-auto md:flex-none",
          className,
          "max-md:!min-h-0 md:min-h-[max(20rem,calc(100dvh-18rem))]",
        )}
        role="status"
      >
        <Spinner aria-hidden="true" className="size-6 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div
      aria-colcount={columnCount}
      aria-label={ariaLabel}
      aria-rowcount={loading ? 0 : (hasRows ? headerGroups.length : 0) + table.getRowCount()}
      aria-busy={loading}
      className={cn(
        "relative flex min-h-0 min-w-0 max-w-full flex-1 flex-col rounded-md text-sm",
        !fillHeight && "md:h-auto md:flex-none",
        hasVisualRows && "max-md:h-auto max-md:min-h-full max-md:flex-none",
        className,
        !hasRows && !loading && "md:min-h-96",
      )}
      role="table"
    >
      <div
        className={cn(
          "relative flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden rounded-md border border-border/80 bg-background shadow-xs",
          !fillHeight && "md:h-auto md:flex-none",
          hasVisualRows &&
            "max-md:h-auto max-md:min-h-full max-md:flex-none max-md:overflow-visible max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:shadow-none",
          !hasRows && !loading && emptyContainerClassName,
        )}
      >
        {hasVisualRows ? (
          <div
            className="hidden shrink-0 overflow-hidden border-b border-border/60 bg-muted/40 md:block"
            role="rowgroup"
          >
            <div
              className="min-w-full will-change-transform"
              ref={headerTrackRef}
            >
              {headerGroups.map((headerGroup, headerGroupIndex) => (
                <div
                  aria-rowindex={headerGroupIndex + 1}
                  className="grid min-h-10 items-center"
                  key={headerGroup.id}
                  role="row"
                  style={rowGridStyle}
                >
                  {headerGroup.headers.map((header) => {
                    const meta = header.column.columnDef.meta

                    return (
                      <div
                        aria-colspan={
                          header.colSpan > 1 ? header.colSpan : undefined
                        }
                        className={cn(
                          "flex min-w-0 items-center px-4 font-medium text-muted-foreground",
                          alignmentClasses[meta?.align ?? "start"],
                          meta?.headerClassName,
                        )}
                        key={header.id}
                        role="columnheader"
                        style={{ gridColumn: `span ${header.colSpan}` }}
                      >
                        {header.isPlaceholder ? null : (
                          <table.FlexRender header={header} />
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            "relative isolate min-h-0 min-w-0 max-w-full flex-1 overflow-hidden [clip-path:inset(0)] [contain:paint]",
            !fillHeight && "md:h-auto md:flex-none",
            hasVisualRows &&
              "max-md:flex-none max-md:overflow-visible max-md:[clip-path:none] max-md:[contain:none]",
          )}
        >
          <ScrollArea
            className={cn(
              "min-h-0 min-w-0 max-w-full overflow-hidden rounded-none [&_[data-slot=scroll-area-scrollbar]]:hidden",
              !fillHeight && "md:h-auto md:flex-none",
              hasVisualRows &&
                "max-md:h-auto max-md:overflow-visible max-md:[&_[data-slot=scroll-area-content]]:h-auto max-md:[&_[data-slot=scroll-area-viewport]]:h-auto max-md:[&_[data-slot=scroll-area-viewport]]:overflow-visible",
            )}
            fill={fillHeight}
            scrollFade={false}
            viewportProps={{
              className: cn(
                "max-md:!overflow-visible max-md:overscroll-auto",
                !fillHeight && "md:h-auto md:overflow-y-hidden",
              ),
              onScroll: syncTableScroll,
              ref: scrollViewportRef,
            }}
          >
          <div
            className={cn(
              "min-h-full min-w-full",
              !hasVisualRows && "flex h-full min-h-96",
            )}
            role="rowgroup"
          >
            {showSkeleton ? (
              <div aria-label={loadingLabel} className="w-full" role="status">
                <div aria-hidden="true" className="hidden md:block">
                  {skeletonRows.map((rowIndex) => (
                    <div
                      className={cn(
                        "grid min-h-16 items-center",
                        rowIndex < skeletonRows.length - 1 && rowDividers && "border-b border-border/60",
                      )}
                      key={rowIndex}
                      style={rowGridStyle}
                    >
                      {leafColumns.map((column, columnIndex) => {
                        const isSelection = column.id === "__row-selection"
                        const isAction = column.columnDef.meta?.isAction || column.id === "__subtable-toggle"

                        return (
                          <div
                            className={cn(
                              "flex min-w-0 items-center px-4",
                              alignmentClasses[column.columnDef.meta?.align ?? "start"],
                              column.columnDef.meta?.cellClassName,
                            )}
                            key={column.id}
                          >
                            {isSelection ? (
                              <Skeleton className="size-4.5 shrink-0 rounded-[.25rem] sm:size-4" />
                            ) : column.id === "__subtable-toggle" ? (
                              <Skeleton className="size-7 rounded-md sm:size-6" />
                            ) : (
                              <TableCellSkeleton
                                columnIndex={columnIndex}
                                rowIndex={rowIndex}
                                variant={column.columnDef.meta?.skeleton ?? (isAction ? "actions" : "text")}
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
                <div aria-hidden="true" className="flex min-h-full min-w-0 flex-col gap-4 md:hidden">
                  {skeletonRows.map((rowIndex) => (
                    <div className="min-w-0" key={rowIndex}>
                      <div className={cn(
                        "relative flex min-w-0 flex-col gap-4 rounded-lg border border-border/80 bg-background p-4 shadow-xs",
                        typeof rowClassName === "string" && rowClassName,
                      )}>
                        {isMultiSelectEnabled || subtable ? (
                          <div className="flex min-w-0 items-center justify-between gap-3">
                            <div className="flex items-center gap-1">
                              {isMultiSelectEnabled ? <Skeleton className="size-4.5 shrink-0 rounded-[.25rem] sm:size-4" /> : null}
                              {subtable ? <Skeleton className="size-7 rounded-md sm:size-6" /> : null}
                            </div>
                          </div>
                        ) : null}
                        {hasMobileTopRightAction ? <Skeleton className="absolute right-3 top-3 size-9 rounded-lg" /> : null}
                        <dl className="flex min-w-0 flex-col gap-3">
                          {leafColumns.filter((column) =>
                            column.id !== "__row-selection" &&
                            column.id !== "__subtable-toggle" &&
                            !column.columnDef.meta?.isAction,
                          ).map((column, columnIndex) => {
                            const header = mobileHeaders.find((item) => item.column.id === column.id)

                            return (
                              <div className="flex min-w-0 flex-col gap-1" key={column.id}>
                                <dt className="text-xs font-medium text-muted-foreground">
                                  {header && !header.isPlaceholder ? (
                                    <table.FlexRender header={header} />
                                  ) : null}
                                </dt>
                                <dd className={cn(
                                  "min-w-0",
                                  hasMobileTopRightAction && columnIndex === 0 && "pe-10",
                                  column.columnDef.meta?.skeleton === "textLines" && "min-h-10",
                                )}>
                                  <TableCellSkeleton
                                    columnIndex={columnIndex}
                                    mobile={true}
                                    rowIndex={rowIndex}
                                    variant={column.columnDef.meta?.skeleton ?? "text"}
                                  />
                                </dd>
                              </div>
                            )
                          })}
                        </dl>
                        {leafColumns.some((column) => column.columnDef.meta?.isAction) && !hasMobileTopRightAction ? (
                          <div className="w-full">
                            <TableCellSkeleton columnIndex={0} mobile={true} rowIndex={rowIndex} variant="actions" />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : hasRows ? (
              <>
                <div className="hidden md:block">
                  {rows.map((row, rowIndex) => {
                const isExpanded = subtable && (expandedRowIds[row.id] ?? getDefaultExpanded(subtable, row.original))
                const rowIsClickable = Boolean(onRowClick) && (isRowClickable?.(row.original) ?? true)

                return (
                  <div className="min-w-0" key={row.id}>
                    <div
                  aria-rowindex={
                    headerGroups.length + pageIndex * pageSize + rowIndex + 1
                  }
                  aria-selected={
                    multiSelect ? row.getIsSelected() : undefined
                  }
                    className={cn(
                      "grid min-h-16 items-center transition-colors",
                      (subtable || rowIsClickable) && "cursor-pointer hover:bg-muted/36",
                    subtable
                      ? cn(
                        "border-b",
                        isExpanded || rowIndex === rows.length - 1 ? "border-transparent" : "border-border/60",
                      )
                      : rowDividers && (
                        rows.length === 1
                          ? "border-b border-transparent"
                          : rowIndex < rows.length - 1 && "border-b border-border/60"
                      ),
                    row.getIsSelected() && "bg-muted/48",
                    typeof rowClassName === "function"
                      ? rowClassName(row.original)
                      : rowClassName,
                  )}
                  onClick={subtable ? (event) => {
                    if (isInteractiveTarget(event)) return
                    toggleSubtable(row.id, Boolean(isExpanded))
                  } : rowIsClickable && onRowClick ? (event) => {
                    if (isInteractiveTarget(event)) return
                    onRowClick(row.original)
                  } : undefined}
                  onKeyDown={!subtable && rowIsClickable && onRowClick ? (event) => {
                    if (event.key !== "Enter" && event.key !== " ") return
                    if (isInteractiveTarget(event)) return
                    event.preventDefault()
                    onRowClick(row.original)
                  } : undefined}
                  role="row"
                  tabIndex={!subtable && rowIsClickable ? 0 : undefined}
                  style={rowGridStyle}
                >
                  {row.getAllCells().map((cell) => {
                    const meta = cell.column.columnDef.meta

                    return (
                      <div
                        className={cn(
                          "flex min-w-0 items-center px-4",
                          alignmentClasses[meta?.align ?? "start"],
                          meta?.cellClassName,
                        )}
                        key={cell.id}
                        role="cell"
                      >
                        <table.FlexRender cell={cell} />
                      </div>
                    )
                  })}
                </div>
                    {subtable && isExpanded ? (
                      <div className={cn("grid border-b bg-muted/24 px-4 py-3", rowIndex < rows.length - 1 ? "border-border/60" : "border-transparent")} role="row" style={rowGridStyle}>
                        <div className="min-w-0" role="cell" style={{ gridColumn: "1 / -1" }}>
                          {subtable.render(row.original)}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
                  })}
                </div>

                <div className="flex min-h-full min-w-0 flex-col gap-4 md:hidden">
                  {rows.map((row, rowIndex) => {
                    const isExpanded = subtable && (expandedRowIds[row.id] ?? getDefaultExpanded(subtable, row.original))
                    const rowIsClickable = Boolean(onRowClick) && (isRowClickable?.(row.original) ?? true)
                    const utilityCells = row.getAllCells().filter((cell) =>
                      cell.column.id === "__row-selection" ||
                      cell.column.id === "__subtable-toggle",
                    )
                    const actionCell = row.getAllCells().find(
                      (cell) =>
                        cell.column.id === "actions" ||
                        cell.column.columnDef.meta?.isAction === true,
                    )
                    const mobileTopRightAction = actionCell?.column.columnDef.meta?.mobileActionPlacement === "top-right"
                    const contentCells = row.getAllCells().filter(
                      (cell) =>
                        !utilityCells.includes(cell) && cell !== actionCell,
                    )

                    return (
                      <div className="min-w-0" key={row.id}>
                        <div
                          aria-rowindex={
                            headerGroups.length + pageIndex * pageSize + rowIndex + 1
                          }
                          aria-selected={
                            multiSelect ? row.getIsSelected() : undefined
                          }
                          className={cn(
                            "flex min-w-0 flex-col gap-4 rounded-lg border border-border/80 bg-background p-4 shadow-xs transition-colors",
                            (subtable || rowIsClickable) && "cursor-pointer hover:bg-muted/20",
                            row.getIsSelected() && "bg-muted/48",
                            typeof rowClassName === "function"
                              ? rowClassName(row.original)
                              : rowClassName,
                          )}
                          onClick={subtable ? (event) => {
                            if (isInteractiveTarget(event)) return
                            toggleSubtable(row.id, Boolean(isExpanded))
                          } : rowIsClickable && onRowClick ? (event) => {
                            if (isInteractiveTarget(event)) return
                            onRowClick(row.original)
                          } : undefined}
                          onKeyDown={!subtable && rowIsClickable && onRowClick ? (event) => {
                            if (event.key !== "Enter" && event.key !== " ") return
                            if (isInteractiveTarget(event)) return
                            event.preventDefault()
                            onRowClick(row.original)
                          } : undefined}
                          role="row"
                          tabIndex={!subtable && rowIsClickable ? 0 : undefined}
                        >
                          {utilityCells.length > 0 ? (
                            <div className="flex min-w-0 items-center justify-between gap-3">
                              <div className="flex items-center gap-1">
                                {utilityCells.map((cell) => (
                                  <div className="flex items-center" key={cell.id}>
                                    <table.FlexRender cell={cell} />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {mobileTopRightAction && actionCell ? (
                            <div className="absolute right-3 top-3 z-10 flex items-center" role="cell">
                              <table.FlexRender cell={actionCell} />
                            </div>
                          ) : null}

                          <dl className="flex min-w-0 flex-col gap-3">
                            {contentCells.map((cell, contentIndex) => {
                              const header = mobileHeaders.find(
                                (item) => item.column.id === cell.column.id,
                              )

                              return (
                                <div
                                  className="flex min-w-0 flex-col gap-1"
                                  key={cell.id}
                                  role="cell"
                                >
                                  <dt className="text-xs font-medium text-muted-foreground">
                                    {header && !header.isPlaceholder ? (
                                      <table.FlexRender header={header} />
                                    ) : null}
                                  </dt>
                                  <dd className={cn(
                                    "min-w-0",
                                    mobileTopRightAction && contentIndex === 0 && "pe-10",
                                    cell.column.columnDef.meta?.skeleton === "textLines" && "min-h-10",
                                  )}>
                                    <table.FlexRender cell={cell} />
                                  </dd>
                                </div>
                              )
                            })}
                          </dl>

                          {actionCell && !mobileTopRightAction ? (
                            <div
                              className="w-full [&_[data-slot=button]]:w-full"
                              role="cell"
                            >
                              <table.FlexRender cell={actionCell} />
                            </div>
                          ) : null}
                        </div>

                        {subtable && isExpanded ? (
                          <div
                            className="min-w-0 border-x border-b border-border/60 bg-muted/24 px-4 py-3"
                            role="row"
                          >
                            <div className="min-w-0" role="cell">
                              {subtable.render(row.original)}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div
                className="flex min-h-96 w-full flex-1 items-center justify-center text-center"
                role="row"
              >
                <div aria-colspan={columnCount} className="flex size-full min-w-0" role="cell">
                  {emptyContent}
                </div>
              </div>
            )}
          </div>
          </ScrollArea>

          {showTopFade ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-8 items-center justify-center bg-gradient-to-b from-background via-background/80 to-transparent"
            >
              <Icon
                aria-hidden="true"
                className="-translate-y-1.5 text-muted-foreground/60"
                name="chevronUp"
                size={14}
              />
            </div>
          ) : null}

          {showBottomFade ? (
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-8 items-center justify-center bg-gradient-to-t from-background via-background/80 to-transparent",
                fillHeight && "max-md:hidden",
              )}
            >
              <Icon
                aria-hidden="true"
                className="translate-y-1.5 text-muted-foreground/60"
                name="chevronDown"
                size={14}
              />
            </div>
          ) : null}
        </div>

        {horizontalScrollbarWidth > 0 ? (
          <div className="h-[16.05px] shrink-0 border-t border-border/60">
            <div
              aria-label={t("table.scrollColumns")}
              className="size-full overflow-x-auto overflow-y-hidden overscroll-x-none [scrollbar-color:color-mix(in_oklab,var(--color-foreground)_20%,transparent)_transparent]  [&::-webkit-scrollbar]:h-full [&::-webkit-scrollbar]:border-0 [&::-webkit-scrollbar-track]:border-0 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-0 [&::-webkit-scrollbar-thumb]:bg-foreground/20"
              onScroll={syncScrollbarScroll}
              ref={horizontalScrollbarRef}
            >
              <div style={{ width: horizontalScrollbarWidth }} />
            </div>
          </div>
        ) : null}

        {showLeftFade ? (
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute top-0 bottom-0 left-0 z-10 flex w-8 items-center justify-center bg-gradient-to-r from-background via-background/80 to-transparent",
              horizontalScrollbarWidth > 0 && "bottom-4",
            )}
          >
            <Icon
              aria-hidden="true"
                className="-translate-x-1.5 text-muted-foreground/60"
              name="chevronLeft"
              size={14}
            />
          </div>
        ) : null}

        {showRightFade ? (
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute top-0 right-0 bottom-0 z-10 flex w-8 items-center justify-center bg-gradient-to-l from-background via-background/80 to-transparent",
              horizontalScrollbarWidth > 0 && "bottom-4",
            )}
          >
            <Icon
              aria-hidden="true"
                className="translate-x-1.5 text-muted-foreground/60"
              name="chevronRight"
              size={14}
            />
          </div>
        ) : null}

      </div>

      {isPaginationEnabled && pagination ? (
        <div className="flex shrink-0 justify-end mt-3">
          <Pagination
            aria-label={pagination.ariaLabel}
            className="mx-0 w-auto justify-end"
          >
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  aria-label={pagination.previousLabel}
                  render={
                    <Button
                      disabled={!table.getCanPreviousPage()}
                      onClick={() => goToPage(pageIndex - 1)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    />
                  }
                >
                  <Icon
                    aria-hidden="true"
                    className="sm:-ms-1"
                    name="chevronLeft"
                  />
                  <span className="max-md:hidden">
                    {pagination.previousLabel}
                  </span>
                </PaginationPrevious>
              </PaginationItem>
              {paginationItems.map((item) =>
                typeof item === "number" ? (
                  <PaginationItem key={item}>
                    <PaginationLink
                      aria-label={pagination.pageLabel(item + 1)}
                      isActive={item === pageIndex}
                      render={
                        <Button
                          onClick={() => goToPage(item)}
                          size="icon-sm"
                          type="button"
                          variant={item === pageIndex ? "outline" : "ghost"}
                        />
                      }
                    >
                      {item + 1}
                    </PaginationLink>
                  </PaginationItem>
                ) : (
                  <PaginationItem key={item}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ),
              )}
              <PaginationItem>
                <PaginationNext
                  aria-label={pagination.nextLabel}
                  render={
                    <Button
                      disabled={!table.getCanNextPage()}
                      onClick={() => goToPage(pageIndex + 1)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    />
                  }
                >
                  <span className="max-md:hidden">{pagination.nextLabel}</span>
                  <Icon
                    aria-hidden="true"
                    className="sm:-me-1"
                    name="chevronRight"
                  />
                </PaginationNext>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      ) : null}

      {fixedSelectionToolbar
        ? bodyPortalTarget && createPortal(selectionToolbar, bodyPortalTarget)
        : selectionToolbar}
    </div>
  )
}

function TableCellSkeleton({
  columnIndex,
  mobile = false,
  rowIndex,
  variant,
}: {
  columnIndex: number
  mobile?: boolean
  rowIndex: number
  variant: "text" | "textLines" | "avatarText" | "badge" | "actions"
}) {
  if (variant === "actions") {
    return (
      <div className={cn("flex items-center gap-1", mobile && "w-full")}>
        <Skeleton className={cn("h-8 rounded-lg sm:h-7", mobile ? "min-w-0 flex-1" : "w-8 sm:w-7")} />
        <Skeleton className={cn("h-8 rounded-lg sm:h-7", mobile ? "min-w-0 flex-1" : "w-8 sm:w-7")} />
      </div>
    )
  }

  if (variant === "avatarText") {
    return (
      <div className="flex min-w-0 w-full items-center gap-3">
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <div className="grid min-w-0 w-full max-w-40 gap-1.5">
          <div className="flex h-5 items-center"><Skeleton className="h-3.5 w-4/5" /></div>
          <div className="flex h-4 items-center"><Skeleton className="h-3 w-3/5" /></div>
        </div>
      </div>
    )
  }

  if (variant === "badge") {
    return <Skeleton className="h-5.5 w-16 rounded-sm sm:h-4.5" />
  }

  if (variant === "textLines") {
    return (
      <div className="flex w-full min-w-0 flex-col">
        <div className="flex h-5 w-full items-center">
          <Skeleton className="h-3.5 w-4/5" />
        </div>
        <div className="flex h-5 w-full items-center">
          <Skeleton className="h-3.5 w-3/5" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-5 w-full items-center">
      <Skeleton className={cn("h-3.5", (rowIndex + columnIndex) % 3 === 0 ? "w-2/3" : "w-4/5")} />
    </div>
  )
}

function getDefaultExpanded<Row extends RowData>(subtable: TanStackTableSubtable<Row>, row: Row) {
  return typeof subtable.defaultExpanded === "function"
    ? subtable.defaultExpanded(row)
    : subtable.defaultExpanded ?? false
}

function isInteractiveTarget(event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) {
  return event.target instanceof Element && Boolean(event.target.closest("a, button, input, select, textarea, [data-slot=checkbox], [data-slot=switch], [role=button], [role=checkbox], [role=switch]"))
}

type PaginationItemValue = number | "ellipsis-start" | "ellipsis-end"

function getPaginationItems(
  pageIndex: number,
  pageCount: number,
): PaginationItemValue[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index)
  }

  if (pageIndex <= 3) {
    return [0, 1, 2, 3, 4, "ellipsis-end", pageCount - 1]
  }

  if (pageIndex >= pageCount - 4) {
    return [
      0,
      "ellipsis-start",
      pageCount - 5,
      pageCount - 4,
      pageCount - 3,
      pageCount - 2,
      pageCount - 1,
    ]
  }

  return [
    0,
    "ellipsis-start",
    pageIndex - 1,
    pageIndex,
    pageIndex + 1,
    "ellipsis-end",
    pageCount - 1,
  ]
}

function getRowGridStyle(
  columns: Array<TanStackTableColumnMeta | undefined>,
): CSSProperties {
  const minimumWidths = columns.map((column) =>
    toCssSize(column?.width ?? column?.minWidth ?? 0),
  )

  return {
    gridTemplateColumns: columns
      .map((column) =>
        column?.width !== undefined
          ? toCssSize(column.width)
          : `minmax(${toCssSize(column?.minWidth ?? 0)}, ${column?.grow ?? 1}fr)`,
      )
      .join(" "),
    minWidth: `calc(${minimumWidths.join(" + ")})`,
  }
}

function toCssSize(value: CSSProperties["width"]): string {
  return typeof value === "number" ? `${value}px` : (value ?? "0px")
}
