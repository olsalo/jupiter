import { Outlet } from "react-router"

export const handle = { theme: "light", publicBooking: true }

export default function BookingLayout() {
  return <Outlet />
}
