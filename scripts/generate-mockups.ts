import "dotenv/config"
import { readFile, rename, writeFile } from "node:fs/promises"
import { basename, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const scriptDirectory = fileURLToPath(new URL(".", import.meta.url))
const projectDirectory = resolve(scriptDirectory, "..")
const publicDirectory = resolve(projectDirectory, "public")
const apiUrl = process.env.MOCKUP_API_URL ?? "http://localhost:3000/api/mockup"
const token = process.env.MOCKUP_API_TOKEN ?? "123"

const variants = [
  { theme: "light", input: "mockup-light.png", output: "mockup-light.avif" },
  { theme: "dark", input: "mockup-dark.png", output: "mockup-dark.avif" },
] as const

const generated: { outputPath: string; result: Uint8Array; theme: string }[] = []

for (const { theme, input, output } of variants) {
  const inputPath = resolve(publicDirectory, input)
  const outputPath = resolve(publicDirectory, output)
  const image = await readFile(inputPath)
  const form = new FormData()
  form.append("image", new Blob([new Uint8Array(image)]), basename(inputPath))

  const endpoint = new URL(apiUrl)
  endpoint.searchParams.set("crop", "true")
  endpoint.searchParams.set("notch", "false")
  endpoint.searchParams.set("reverse", "true")

  let response: Response | undefined
  for (let attempt = 0; attempt < 5; attempt += 1) {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })

    if (response.status !== 503 || attempt === 4) break

    await response.text()
    await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt))
  }

  if (!response?.ok) {
    const details = await response?.text()
    throw new Error(`Could not generate the ${theme} mockup (${response?.status}): ${details}`)
  }

  const result = new Uint8Array(await response.arrayBuffer())
  if (result.length === 0) {
    throw new Error(`The mockup API returned an empty ${theme} image`)
  }

  generated.push({ outputPath, result, theme })
}

await Promise.all(generated.map(async ({ outputPath, result }) => {
  const temporaryPath = `${outputPath}.tmp`
  await writeFile(temporaryPath, result)
  await rename(temporaryPath, outputPath)
}))

for (const { outputPath, theme } of generated) {
  console.info(`Generated ${theme} mockup: ${outputPath}`)
}
