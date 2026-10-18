import { InformationArchitecturePage } from "~/components/information-architecture/route-information-architecture"

export const handle = { workspace: true, pageHeader: { titleKey: "bookingPage" } }

export default function Page() {
  return <InformationArchitecturePage section="bookingPage" titleKey="bookingPage" icon="share" />
}
