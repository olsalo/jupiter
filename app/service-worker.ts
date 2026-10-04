type WorkerEventMap = {
  install: { waitUntil: (promise: Promise<unknown>) => void }
  activate: { waitUntil: (promise: Promise<unknown>) => void }
  fetch: {
    request: Request
    respondWith: (response: Promise<Response>) => void
  }
  message: {
    data: { type?: string, locale?: string } | null
    waitUntil: (promise: Promise<unknown>) => void
  }
}

const worker = globalThis as unknown as {
  addEventListener: <Name extends keyof WorkerEventMap>(
    name: Name,
    listener: (event: WorkerEventMap[Name]) => void,
  ) => void
  caches: CacheStorage
  clients: { claim: () => Promise<void> }
  skipWaiting: () => Promise<void>
}

const cachePrefix = "offline-"
const cacheName = `${cachePrefix}v2`
const offlinePage = "/offline.html"
const finnishOfflinePage = "/offline-fi.html"
const localeKey = "/__offline-locale"

worker.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await worker.caches.open(cacheName)
    await cache.add(new Request(offlinePage, { cache: "reload" }))
    await cache.add(new Request(finnishOfflinePage, { cache: "reload" }))
    const savedLocale = await worker.caches.match(localeKey)
    if (savedLocale) await cache.put(localeKey, savedLocale)
    await worker.skipWaiting()
  })())
})

worker.addEventListener("message", (event) => {
  const locale = event.data?.locale
  if (event.data?.type !== "SET_OFFLINE_LOCALE" || (locale !== "en" && locale !== "fi")) return

  event.waitUntil((async () => {
    const cache = await worker.caches.open(cacheName)
    await cache.put(localeKey, new Response(locale))
  })())
})

worker.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await worker.caches.keys()
    await Promise.all(names
      .filter((name) => name.startsWith(cachePrefix) && name !== cacheName)
      .map((name) => worker.caches.delete(name)))
    await worker.clients.claim()
  })())
})

worker.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.mode !== "navigate") return

  event.respondWith((async () => {
    try {
      return await fetch(event.request, { cache: "no-store" })
    } catch {
      const cache = await worker.caches.open(cacheName)
      const locale = await cache.match(localeKey)
      const page = locale && await locale.text() === "fi" ? finnishOfflinePage : offlinePage
      return await cache.match(page) ?? Response.error()
    }
  })())
})

export {}
