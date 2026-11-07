export function getAppBaseUrl(requestUrl: URL, configuredUrl = process.env.BETTER_AUTH_URL) {
  if (!configuredUrl?.trim()) return ""
  const appUrl = new URL(configuredUrl.trim())
  if (!["http:", "https:"].includes(appUrl.protocol) || appUrl.username || appUrl.password || appUrl.pathname !== "/" || appUrl.search || appUrl.hash) {
    throw new Error("BETTER_AUTH_URL must be an HTTP or HTTPS origin without a path")
  }
  return appUrl.origin === requestUrl.origin ? "" : appUrl.origin
}
