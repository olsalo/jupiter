import { InformationArchitecturePage } from "~/components/information-architecture/route-information-architecture"

export const handle = { workspace: true, pageLayout: "scroll" }

export default function Page() {
  return <InformationArchitecturePage section="bookingPage" titleKey="bookingPage" icon="share" />
}
