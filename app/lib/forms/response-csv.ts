type ExportResponse = {
  respondentEmail: string | null
  submittedAt: Date
  sections: { answers: { id: string, label: string, values: string[] }[] }[]
}

function csvCell(value: string) {
  // Keep submitted text from being interpreted as a spreadsheet formula.
  const text = /^[\s]*[=+@-]|^[\t\r\n]/.test(value) ? `'${value}` : value
  return `"${text.replaceAll('"', '""')}"`
}

export function responsesToCsv(
  responses: ExportResponse[],
  labels: { responder: string, submittedAt: string, anonymous: string },
  formatSubmittedAt: (date: Date) => string,
) {
  const questions = new Map<string, string>()
  for (const response of responses) {
    for (const answer of response.sections.flatMap((section) => section.answers)) {
      if (!questions.has(answer.id)) questions.set(answer.id, answer.label)
    }
  }
  const rows = [[labels.responder, labels.submittedAt, ...questions.values()]]
  for (const response of responses) {
    const answers = new Map(response.sections.flatMap((section) => section.answers).map((answer) => [answer.id, answer.values.join("\n")]))
    rows.push([
      response.respondentEmail ?? labels.anonymous,
      formatSubmittedAt(response.submittedAt),
      ...Array.from(questions.keys(), (id) => answers.get(id) ?? ""),
    ])
  }
  // UTF-8 BOM preserves Finnish characters when the file is opened in Excel.
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n"
}
