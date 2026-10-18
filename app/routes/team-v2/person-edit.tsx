import { Outlet } from "react-router"
import PersonEdit from "../team/person-edit"

export { loader, clientLoader, handle } from "../team/person-edit"

export default function PersonEditWithCreate() {
  return <><PersonEdit /><Outlet /></>
}
