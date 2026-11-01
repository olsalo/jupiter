export function loader() {
  return Response.json({ version: import.meta.env.APP_BUILD_ID }, {
    headers: { "Cache-Control": "no-store" },
  })
}
