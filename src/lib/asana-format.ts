// Bereitet Text für Asanas html_notes-Feld auf. Gemeinsam genutzt von allen
// Routen, die Asana-Aufgaben mit HTML-Inhalt anlegen (submit, versand,
// undelivered) — eine einzige Stelle für dieses sicherheitsrelevante Escaping.
export function escapeHtmlContent(str: string): string {
  return str
    // strip characters that Asana's XML parser rejects: C0 controls (except
    // tab/LF/CR, e.g. GS1 barcode separators from scanners), DEL, C1 controls,
    // unpaired surrogates and non-characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F￾￿]/g, '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
