import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router"

import Icon from "~/components/icons"
import { UserAvatar } from "~/components/data-display/user-avatar"
import { Badge } from "~/components/ui/badge"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "~/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Spinner } from "~/components/ui/spinner"
import { useMediaQuery } from "~/lib/hooks"
import { cn } from "~/lib/utils"
import { customerName, type CustomerSummary } from "./customer-types"
import { Button } from "~/components/ui/button"

export function CustomerList({ customers, hasMore, fetchingMore, onLoadMore, selectedId, loading, failed, search, onSearchChange }: {
  search: string
  onSearchChange: (value: string) => void
  customers: CustomerSummary[]
  hasMore: boolean
  fetchingMore: boolean
  onLoadMore: () => void
  selectedId?: string
  loading: boolean
  failed: boolean
}) {
  const { t } = useTranslation()
  const location = useLocation()
  const mobile = useMediaQuery("max-640px")
  const searchTerm = search.trim().toLocaleLowerCase()

  const header = (
    <header className="hidden shrink-0 px-4 pb-3 pt-4 sm:block">
      <div className="relative grid gap-3">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <h2 className="text-lg font-medium tracking-tight">{t("customerPage.title")}</h2>
          {!loading && !failed ? <Badge className="tabular-nums" variant="secondary">{customers.length}</Badge> : null}
        </div>
        <InputGroup>
          <InputGroupInput aria-label={t("customerPage.search")} onChange={(event) => onSearchChange(event.target.value)} placeholder={t("customerPage.search")} type="search" value={search} />
          <InputGroupAddon><Icon aria-hidden={true} name="search" size={16} /></InputGroupAddon>
        </InputGroup>
      </div>
    </header>
  )
  const content = (
    <>
    {loading ? <div className="flex min-h-40 flex-1 items-center justify-center p-6"><Spinner aria-label={t("customerPage.loading")} /></div> : failed ? null : !customers.length ? <Empty className="px-4 py-12 md:p-6"><EmptyHeader><EmptyTitle className="text-base">{t(searchTerm ? "customerPage.noMatches" : "customerPage.empty")}</EmptyTitle>{!searchTerm ? <EmptyDescription>{t("customerPage.emptyDescription")}</EmptyDescription> : null}</EmptyHeader></Empty> : <nav aria-label={t("customerPage.title")} className="grid gap-3 sm:gap-1 sm:p-2">
      {customers.map((customer) => {
        const selected = customer.id === selectedId
        return <Link
          aria-current={selected ? "page" : undefined}
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
          className={cn("flex min-h-15 min-w-0 items-center gap-3 rounded-lg border max-sm:bg-background p-3 text-base sm:border-0 sm:px-3 sm:min-h-14 sm:py-2 sm:text-sm transition-colors outline-none hover:bg-muted/70 active:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", selected && "bg-muted sm:font-medium hover:bg-muted active:bg-muted")}
          key={customer.id}
          preventScrollReset={true}
          replace={true}
          to={{ pathname: selected ? "/customers" : `/customers/${encodeURIComponent(customer.id)}`, search: location.search }}
          state={{ ...location.state, returnTo: "/customers" }}
        >
          <UserAvatar className="size-9" decorative={true} name={customerName(customer)} stableId={customer.id} />
          <span className="min-w-0 truncate">{customerName(customer)}</span>
        </Link>
      })}
    </nav>}
    {hasMore ? <div className="pt-3 sm:p-4 sm:pt-2"><Button className="w-full" disabled={fetchingMore} loading={fetchingMore} onClick={onLoadMore} type="button" variant="outline">{t("customerPage.loadMore")}</Button></div> : null}
    </>
  )

  return mobile ? content : (
    <div className="flex min-h-0 flex-1 flex-col">
      {header}
      <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-content]]:flex [&_[data-slot=scroll-area-content]]:min-h-full [&_[data-slot=scroll-area-content]]:flex-col" overscrollContain={true} scrollFade={true}>
        {content}
      </ScrollArea>
    </div>
  )
}
