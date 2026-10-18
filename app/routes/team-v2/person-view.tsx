import { Outlet } from "react-router"
import PersonView from "../team/person-view"

export { loader, clientLoader } from "../team/person-view"

export default function PersonViewWithCreate() {
  return <><PersonView /><Outlet /></>
}
