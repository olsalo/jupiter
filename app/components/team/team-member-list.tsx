import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useLocation, useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"

import Icon from "~/components/icons"
import { UserAvatar } from "~/components/user-avatar"
import { Badge } from "~/components/ui/badge"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "~/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/lib/utils"
import type { TeamPerson } from "./team-types"

export function TeamMemberList({ people, selectedId, loading, failed }: {
  people: TeamPerson[]
  selectedId?: string
  loading: boolean
  failed: boolean
}) {
  const { t } = useTranslation("team")
  const location = useLocation()
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const [search, setSearch] = useState("")
  const searchTerm = search.trim().toLocaleLowerCase()
  const filteredPeople = people.filter((person) => person.name.toLocaleLowerCase().includes(searchTerm))

  return (
    <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-content]]:flex [&_[data-slot=scroll-area-content]]:min-h-full [&_[data-slot=scroll-area-content]]:flex-col" overscrollContain={true} scrollFade={true} stickyHeader={
      <header className="relative z-10 shrink-0 px-4 pb-3 pt-4">
        <div aria-hidden={true} className="pointer-events-none absolute inset-x-0 top-0 -bottom-3 bg-background/95 backdrop-blur-[40px] backdrop-saturate-150 mask-[linear-gradient(to_bottom,black_0%,black_75%,transparent_100%)]" />
        <div className="relative grid gap-3">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <h2 className="text-lg font-medium tracking-tight">{t("members")}</h2>
            {!loading && !failed ? <Badge className="tabular-nums" variant="secondary">{filteredPeople.length}</Badge> : null}
          </div>
          <InputGroup>
            <InputGroupInput aria-label={t("people.search")} onChange={(event) => setSearch(event.target.value)} placeholder={t("people.search")} type="search" value={search} />
            <InputGroupAddon><Icon aria-hidden={true} name="search" size={16} /></InputGroupAddon>
          </InputGroup>
        </div>
      </header>
    }>
      {loading ? <div className="flex min-h-40 flex-1 items-center justify-center p-6"><Spinner aria-label={t("loading")} /></div> : failed ? null : !filteredPeople.length ? <Empty className="px-4 py-12 md:p-6"><EmptyHeader><EmptyTitle className="text-base">{t(searchTerm ? "people.noMatches" : "noMembers")}</EmptyTitle>{!searchTerm ? <EmptyDescription>{t("noMembersDescription")}</EmptyDescription> : null}</EmptyHeader></Empty> : <nav aria-label={t("members")} className="grid gap-1 p-2">
        {filteredPeople.map((person) => {
          const selected = person.id === selectedId
          return <Link
            aria-current={selected ? "page" : undefined}
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            className={cn("flex min-h-14 min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors outline-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", selected && "bg-muted font-medium hover:bg-muted")}
            key={person.id}
            preventScrollReset={true}
            replace={true}
            to={{ pathname: selected ? "/team-v2" : `/team-v2/${encodeURIComponent(person.id)}`, search: location.search }}
            state={{ ...location.state, returnTo: "/team-v2" }}
          >
            <UserAvatar className="size-9" decorative={true} name={person.name} src={person.image} stableId={person.member?.user.id ?? person.id} />
            <span className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 truncate">{person.name}</span>
              {root?.user?.id && person.member?.user.id === root.user.id ? <Badge size="sm" variant="secondary">{t("youBadge")}</Badge> : null}
            </span>
          </Link>
        })}
      </nav>}
    </ScrollArea>
  )
}
