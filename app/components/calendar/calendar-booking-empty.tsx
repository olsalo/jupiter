import Icon, { type AppIconName } from "~/components/icons"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty"

export function CalendarBookingEmpty({ icon, title, description }: {
  icon: AppIconName
  title: string
  description: string
}) {
  return <Empty className="min-h-56 w-full px-2 py-8 md:px-2 md:py-8">
    <EmptyHeader>
      <EmptyMedia variant="icon"><Icon aria-hidden={true} name={icon} /></EmptyMedia>
      <EmptyTitle className="text-base">{title}</EmptyTitle>
      <EmptyDescription>{description}</EmptyDescription>
    </EmptyHeader>
  </Empty>
}
