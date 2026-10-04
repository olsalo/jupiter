import assert from "node:assert/strict"

const { responsesToCsv } = await import(new URL("../app/lib/forms/response-csv.ts", import.meta.url).href) as typeof import("../app/lib/forms/response-csv")

const labels = { responder: "Vastaaja", submittedAt: "Lähetetty", anonymous: "Anonyymi vastaaja" }
const submittedAt = new Date("2026-10-02T10:00:00Z")
const csv = responsesToCsv([
  {
    respondentEmail: "olli@example.com",
    submittedAt,
    sections: [{ answers: [
      { id: "name", label: "Nimi", values: ['Ääkköset, "kyllä"'] },
      { id: "choices", label: "Valinnat", values: ["Yksi", "Kaksi"] },
    ] }],
  },
  {
    respondentEmail: null,
    submittedAt,
    sections: [{ answers: [
      { id: "name", label: "Nimi ennen muutosta", values: ["Vanha vastaus"] },
      { id: "removed", label: "Poistettu kysymys", values: ["Säilyy"] },
    ] }],
  },
], labels, () => "02.10.2026 13:00")

assert.equal(csv, '\uFEFF"Vastaaja","Lähetetty","Nimi","Valinnat","Poistettu kysymys"\r\n' +
  '"olli@example.com","02.10.2026 13:00","Ääkköset, ""kyllä""","Yksi\nKaksi",""\r\n' +
  '"Anonyymi vastaaja","02.10.2026 13:00","Vanha vastaus","","Säilyy"\r\n')

for (const value of ["=1+1", "+SUM(A1)", "-1+2", "@SUM(A1)", "  =1+1", "\t=1+1", "\r=1+1"]) {
  const result = responsesToCsv([{
    respondentEmail: value,
    submittedAt,
    sections: [{ answers: [{ id: "question", label: value, values: [value] }] }],
  }], labels, () => "date")
  assert.ok(result.includes(`"'${value}"`), "Formula-like content must be exported as text")
  assert.ok(!result.includes(`,"${value}"`), "Headers and answer cells must also be protected")
}

assert.equal(responsesToCsv([], labels, () => "date"), '\uFEFF"Vastaaja","Lähetetty"\r\n')
console.info("PASS CSV preserves historical questions, multiple answers, Finnish text, quoting, and safe spreadsheet cells")
