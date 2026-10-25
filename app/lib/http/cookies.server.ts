import { createCookie } from "react-router"

const preferenceCookieMaxAge = 60 * 60 * 24 * 365
export const localeCookie = createCookie("lng", {
  path: "/",
  maxAge: preferenceCookieMaxAge,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  httpOnly: true,
})

export const formatPreferenceCookie = createCookie("format", {
  path: "/",
  maxAge: preferenceCookieMaxAge,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  httpOnly: true,
})

export const themeCookie = createCookie("theme", {
  path: "/",
  maxAge: preferenceCookieMaxAge,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  httpOnly: true,
})
