import "dotenv/config"
import { createServer } from "vite"
import type { Prisma } from "../generated/prisma/client"

const vite = await createServer({
  configFile: false,
  appType: "custom",
  resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } },
  server: { middlewareMode: true, hmr: false, watch: null },
})

try {
  const { prisma } = await vite.ssrLoadModule("/app/lib/prisma.server.ts") as typeof import("../app/lib/prisma.server")
  try {
    const { generateId } = await vite.ssrLoadModule("/app/lib/id.ts") as typeof import("../app/lib/id")
    const { formEditorInclude, toEditorDraft } = await vite.ssrLoadModule("/app/.server/services/forms/form-editor.ts") as typeof import("../app/.server/services/forms/form-editor")
    const { buildFormSnapshot } = await vite.ssrLoadModule("/app/lib/forms/form-snapshot.ts") as typeof import("../app/lib/forms/form-snapshot")
    const result = await prisma.$transaction(async (tx) => {
      const organizations = await tx.organization.findMany({ select: {
        id: true, name: true, slug: true,
        members: { select: { userId: true, role: true }, orderBy: { createdAt: "asc" } },
      } })
      if (organizations.length !== 1) throw new Error("This example requires exactly one organization")
      const organization = organizations[0]
      const slug = `${organization.slug}-asiakaspalaute-esimerkki`
      const existing = await tx.form.findUnique({ where: { slug }, include: formEditorInclude })
      if (existing) {
        if (existing.organizationId !== organization.id) throw new Error("The example slug belongs to a different organization")
        buildFormSnapshot(toEditorDraft(existing))
        return { created: false, organization: organization.name, form: existing }
      }

      const textBlock = (label: string, description: string): Prisma.FormItemCreateWithoutSectionInput => ({
        id: generateId("item"), type: "TEXT_BLOCK", label, description, required: false,
      })
      const text = (type: "SHORT_TEXT" | "LONG_TEXT", label: string, required: boolean, description: string, placeholder: string, maxLength: number): Prisma.FormItemCreateWithoutSectionInput => ({
        id: generateId("item"), type, label, required, description, placeholder,
        validation: { ...(required ? { minLength: 1 } : {}), maxLength },
      })
      const choice = (label: string, description: string, options: [string, string][], allowOther = false): Prisma.FormItemCreateWithoutSectionInput => ({
        id: generateId("item"), type: "SINGLE_CHOICE", label, description, required: true,
        validation: { minSelections: 1 }, settings: { allowOther },
        options: { create: options.map(([value, optionLabel], sortOrder) => ({
          id: generateId("option"), label: optionLabel, value, kind: "OPTION", sortOrder,
        })) },
      })
      const items = [
        textBlock("Asiointisi", "Kerro ensin, mitä palvelua tai tuotetta palautteesi koskee."),
        text("SHORT_TEXT", "Nimesi", false, "Voit antaa palautetta myös nimettömänä.", "Etunimi ja sukunimi", 120),
        text("SHORT_TEXT", "Mitä palvelua tai tuotetta käytit?", true, "Esimerkiksi ostamasi tuote tai varaamasi palvelu.", "Palvelun tai tuotteen nimi", 500),
        choice("Miten asioit kanssamme?", "Valitse asiointitapa, jota palautteesi koskee.", [
          ["in_person", "Toimipisteessä"], ["online", "Verkossa"], ["phone", "Puhelimitse"],
        ], true),
        textBlock("Kokemuksesi", "Palautteesi auttaa meitä kehittämään palveluamme. Voit jättää avoimet kysymykset tyhjiksi."),
        choice("Kuinka tyytyväinen olit kokonaisuutena?", "Ajattele koko asiointikokemustasi.", [
          ["very_satisfied", "Erittäin tyytyväinen"], ["satisfied", "Tyytyväinen"],
          ["neutral", "En tyytyväinen enkä tyytymätön"], ["dissatisfied", "Tyytymätön"], ["very_dissatisfied", "Erittäin tyytymätön"],
        ]),
        choice("Suosittelisitko meitä ystävällesi?", "Valitse kokemustasi parhaiten kuvaava vaihtoehto.", [
          ["yes", "Kyllä"], ["maybe", "Ehkä"], ["no", "En"],
        ]),
        text("LONG_TEXT", "Mikä sujui erityisen hyvin?", false, "Kuulemme mielellämme myös onnistumisista.", "Kerro, mihin olit tyytyväinen...", 2000),
        text("LONG_TEXT", "Mitä voisimme tehdä paremmin?", false, "Konkreettiset esimerkit auttavat meitä parantamaan palvelua.", "Kerro kehitysehdotuksesi...", 2000),
        text("LONG_TEXT", "Haluatko kertoa vielä jotain muuta?", false, "Voit lisätä tähän muita huomioita tai toiveita.", "Muut kommentit...", 2000),
        choice("Saammeko ottaa sinuun yhteyttä palautteestasi?", "Jos vastaat kyllä, lisää sähköpostiosoitteesi lomakkeen lopussa.", [
          ["yes", "Kyllä, minuun saa ottaa yhteyttä"], ["no", "Ei, annan vain palautetta"],
        ]),
      ].map((item, sortOrder) => ({ ...item, sortOrder, row: sortOrder, column: 0, width: 12 }))

      const form = await tx.form.create({
        data: {
          id: generateId("form"), organizationId: organization.id, slug,
          createdById: organization.members.find((member) => member.role.split(",").includes("owner"))?.userId ?? organization.members[0]?.userId ?? null,
          title: "Asiakaspalaute",
          description: `Miten asiointisi yrityksessä ${organization.name} sujui? Vastaaminen vie noin 2–3 minuuttia. Voit antaa palautetta nimettömänä. Jos toivot yhteydenottoa, jätä sähköpostiosoitteesi lomakkeen lopussa.`,
          status: "DRAFT", emailCollection: "OPTIONAL",
          submitButtonText: "Lähetä palaute",
          successMessage: "Kiitos palautteestasi! Luemme kaikki palautteet ja käytämme niitä palvelumme kehittämiseen.",
          sections: { create: { id: generateId("section"), items: { create: items } } },
        },
        include: formEditorInclude,
      })
      // Validate the complete draft before committing, without publishing it.
      buildFormSnapshot(toEditorDraft(form))
      return { created: true, organization: organization.name, form }
    }, { timeout: 30000 })

    const saved = await prisma.form.findUniqueOrThrow({ where: { id: result.form.id }, include: formEditorInclude })
    const items = saved.sections.flatMap((section) => section.items)
    console.info(JSON.stringify({
      created: result.created, organization: result.organization,
      id: saved.id, title: saved.title, status: saved.status,
      editorPath: `/forms/${saved.id}/edit`,
      questions: items.filter((item) => item.type !== "TEXT_BLOCK").length,
      textBlocks: items.filter((item) => item.type === "TEXT_BLOCK").length,
      options: items.reduce((count, item) => count + item.options.length, 0),
      emailCollection: saved.emailCollection,
    }, null, 2))
  } finally {
    await prisma.$disconnect()
  }
} finally {
  await vite.close()
}
