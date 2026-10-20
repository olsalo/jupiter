import { Outlet, useOutletContext } from "react-router"
import { CustomerProfile } from "~/components/customers/customer-profile"
import type { CustomerContext } from "~/components/customers/customer-types"

export default function CustomerView() {
  const { customer } = useOutletContext<CustomerContext>()
  return <><CustomerProfile customer={customer} /><Outlet /></>
}
