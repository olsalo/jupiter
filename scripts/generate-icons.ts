import { readFile, writeFile } from "node:fs/promises"
import sharp from "sharp"

const logoUrl = new URL("../public/logo.svg", import.meta.url)
const publicUrl = new URL("../public/", import.meta.url)
const defaultBackground = "#ffffff"
const defaultLogoColor = "#262626"
const standardMarkScale = 0.68
const faviconMarkScale = 0.64

function parseColor(value: string, option: string) {
  if (!/^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) {
    throw new Error(`${option} must be a hex color, such as #ffffff`)
  }

  return value
}

function getBorderColor(background: string) {
  const hex = background.slice(1)
  const channels = hex.length === 3 || hex.length === 4
    ? hex.slice(0, 3).split("").map((channel) => parseInt(channel + channel, 16))
    : [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
  const brightness = (channels[0] * 299 + channels[1] * 587 + channels[2] * 114) / 1000

  return brightness > 145 ? "#000000" : "#ffffff"
}

function getOptions(args: string[]) {
  const options = {
    background: defaultBackground,
    logoColor: defaultLogoColor,
    theme: "light" as "light" | "dark",
    testDots: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--test-dots") {
      options.testDots = true
      continue
    }
    if (args[index] === "--no-test-dots") {
      options.testDots = false
      continue
    }

    const [name, inlineValue] = args[index].split("=", 2)
    const value = inlineValue ?? args[index + 1]

    if (
      name !== "--background" &&
      name !== "--bg-color" &&
      name !== "--logo-color" &&
      name !== "--icon-color" &&
      name !== "--theme"
    ) {
      throw new Error(`Unknown option: ${args[index]}`)
    }
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${name}`)
    }

    if (!inlineValue) index += 1

    if (name === "--theme") {
      if (value !== "light" && value !== "dark") {
        throw new Error(`${name} must be light or dark`)
      }
      options.theme = value
    } else if (name === "--background" || name === "--bg-color") {
      options.background = parseColor(value, name)
    } else {
      options.logoColor = parseColor(value, name)
    }
  }

  if (options.theme === "dark") {
    const background = options.background
    options.background = options.logoColor
    options.logoColor = background
  }

  return options
}

function makeIconSvg({
  background,
  dotColor,
  logoColor,
  path,
  roundCorners = false,
  size,
  viewBox,
}: {
  background: string
  dotColor?: string
  logoColor: string
  path: string
  roundCorners?: boolean
  size: number
  viewBox: string
}) {
  const markSize = size * (roundCorners ? faviconMarkScale : standardMarkScale)
  const inset = (size - markSize) / 2
  const radius = roundCorners ? size * 0.2 : 0
  const borderOpacity = getBorderColor(background) === "#ffffff" ? 0.28 : 0.14
  const border = roundCorners
    ? `x="0.5" y="0.5" width="${size - 1}" height="${size - 1}" stroke="${getBorderColor(background)}" stroke-opacity="${borderOpacity}"`
    : `width="${size}" height="${size}"`
  const testDot = dotColor
    ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.055}" fill="${dotColor}"/>`
    : ""

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect ${border} rx="${radius}" fill="${background}"/><svg x="${inset}" y="${inset}" width="${markSize}" height="${markSize}" viewBox="${viewBox}"><path fill="${logoColor}" d="${path}"/></svg>${testDot}</svg>`
}

async function renderPng(svg: string, size: number) {
  return sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()
}

function toIco(png: Buffer, size: number) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)

  const entry = Buffer.alloc(16)
  entry.writeUInt8(size === 256 ? 0 : size, 0)
  entry.writeUInt8(size === 256 ? 0 : size, 1)
  entry.writeUInt8(0, 2)
  entry.writeUInt8(0, 3)
  entry.writeUInt16LE(1, 4)
  entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(header.length + entry.length, 12)

  return Buffer.concat([header, entry, png])
}

async function main() {
  const options = getOptions(process.argv.slice(2))
  const logoSvg = await readFile(logoUrl, "utf8")
  const viewBox = logoSvg.match(/<svg\b[^>]*\bviewBox="([^"]+)"/i)?.[1]
  const path = logoSvg.match(/<path\b[^>]*\bd="([^"]+)"[^>]*\/?\s*>/i)?.[1]

  if (!viewBox || !path) {
    throw new Error("Could not read the viewBox and path from public/logo.svg")
  }

  const iconSvg = (size: number, dotColor: string) => makeIconSvg({
    background: options.background,
    dotColor: options.testDots ? dotColor : undefined,
    logoColor: options.logoColor,
    path,
    size,
    viewBox,
  })

  await Promise.all([
    writeFile(new URL("pwa-icon.svg", publicUrl), iconSvg(512, "#e84a5f")),
    renderPng(iconSvg(192, "#2589bd"), 192).then((icon) =>
      writeFile(new URL("pwa-icon-192.png", publicUrl), icon),
    ),
    renderPng(iconSvg(512, "#48a868"), 512).then((icon) =>
      writeFile(new URL("pwa-icon-512.png", publicUrl), icon),
    ),
    renderPng(iconSvg(180, "#efa83a"), 180).then((icon) =>
      writeFile(new URL("apple-touch-icon.png", publicUrl), icon),
    ),
  ])

  const faviconSvg = makeIconSvg({
    background: options.background,
    dotColor: options.testDots ? "#8e5bd9" : undefined,
    logoColor: options.logoColor,
    path,
    roundCorners: true,
    size: 48,
    viewBox,
  })
  const faviconPng = await renderPng(faviconSvg, 48)
  await writeFile(new URL("favicon.ico", publicUrl), toIco(faviconPng, 48))

  console.log("Generated padded PWA icons, a 180px Apple touch icon, and a 48px rounded favicon")
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
