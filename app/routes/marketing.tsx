import { MarketingPage } from "~/components/marketing/marketing-page"

export const handle = { marketing: true }

export default function Page() {
  return <MarketingPage requestAccessOnly={true} />
}
