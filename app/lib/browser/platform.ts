function getBrowserUserAgent() {
  return typeof navigator === "undefined" ? "" : navigator.userAgent
}

export function isElectron(userAgent = getBrowserUserAgent()) {
  return /\bElectron\/\d+/.test(userAgent)
}

export function isReactNativeWebView(userAgent = getBrowserUserAgent()) {
  return /\bReactNativeWebView\//.test(userAgent)
}
