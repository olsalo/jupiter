import { InformationArchitecturePage } from "~/components/information-architecture/route-information-architecture"

export const handle = { workspace: true, pageHeader: { titleKey: "customers", createTitleKey: "newCustomer" } }

export default function Page() {
  return <InformationArchitecturePage section="customers" titleKey="customers" icon="user" createTitleKey="newCustomer" />
}
