import { Outlet, useLocation, useNavigate, useOutletContext } from "react-router"
import { CustomerForm } from "~/components/customers/customer-form"
import type { CustomerContext } from "~/components/customers/customer-types"

export const handle = { customerMode: "edit" }

export default function CustomerEdit() {
  const { customer, onPendingChange } = useOutletContext<CustomerContext>()
  const location = useLocation()
  const navigate = useNavigate()
  return <><CustomerForm customer={customer} close={() => navigate("..", { relative: "path", replace: true, state: location.state })} key={customer.id} onPendingChange={onPendingChange} /><Outlet /></>
}
