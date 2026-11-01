import Icon, { type AppIconName } from "~/components/icons"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty"

export function CalendarBookingEmpty({ icon, title, description }: {
  icon: AppIconName
  title: string
  description: string
}) {
  return <Empty className="w-full">
    <EmptyHeader>
      <EmptyMedia variant="icon"><Icon aria-hidden={true} name={icon} /></EmptyMedia>
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>{description}</EmptyDescription>
    </EmptyHeader>
  </Empty>
}
