import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { conditionLabel, reasonLabel } from './return-labels'

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: '#111111' },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 16 },
  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 160, color: '#555555', fontFamily: 'Helvetica-Bold' },
  value: { flex: 1 },
})

export type ReklamationPdfItem = {
  productName: string
  sku?: string | null
  condition: string
  reason: string
}

export type ReklamationPdfOrder = {
  customerNumber: string
  customerName: string
  customerEmail: string
  date?: string
  invoiceNr?: string | null
  partnershop?: string | null
}

export type ReklamationPdfInput = {
  order: ReklamationPdfOrder
  items: ReklamationPdfItem[]
  operatorName: string
  notes?: string
}

function purchaseLocation(partnershop?: string | null): string {
  if (partnershop === 'amazon') return 'Amazon'
  if (partnershop === 'ebay') return 'eBay'
  return 'Online'
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || '—'}</Text>
    </View>
  )
}

function ReklamationDocument({ order, items, operatorName, notes }: ReklamationPdfInput) {
  const today = new Date().toLocaleDateString('de-DE')

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Reklamation Atlantis Berlin</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Angaben zur Aufnahme</Text>
          <Row label="Mitarbeiter" value={operatorName} />
          <Row label="Abgabedatum" value={today} />
          <Row label="Annahmeort" value="Coppistr." />
          <Row label="Abholort" value="Versand zum Kunden" />
          <Row label="Versandadresse" value="Kundenanschrift" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kundendaten</Text>
          <Row label="Kundennummer" value={order.customerNumber} />
          <Row label="Kundenname" value={order.customerName} />
          <Row label="Telefonnummer" value="—" />
          <Row label="Email" value={order.customerEmail} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Abweichende Lieferanschrift</Text>
        </View>

        {items.map((item, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.sectionTitle}>Produkt{items.length > 1 ? ` ${i + 1}` : ''}</Text>
            <Row label="Servicenummer" value="—" />
            <Row label="Hersteller" value="—" />
            <Row label="Artikelname" value={item.productName} />
            <Row label="Beschreibung" value={item.sku} />
          </View>
        ))}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Belege</Text>
          <Row label="Kaufdatum" value={order.date} />
          <Row label="Rechnungsnummer" value={order.invoiceNr} />
          <Row label="Ort des Kaufs" value={purchaseLocation(order.partnershop)} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fehlerbeschreibung</Text>
          {items.map((item, i) => (
            <Row
              key={i}
              label={items.length > 1 ? `Artikel ${i + 1}` : 'Fehlerbeschreibung'}
              value={`Zustand: ${conditionLabel[item.condition] ?? item.condition} · Grund: ${reasonLabel[item.reason] ?? item.reason}${notes ? ` – ${notes}` : ''}`}
            />
          ))}
          <Row label="Fertig?" value="Nein" />
          <Row label="Achtung" value="" />
        </View>
      </Page>
    </Document>
  )
}

export async function renderReklamationPdf(input: ReklamationPdfInput): Promise<Buffer> {
  return renderToBuffer(<ReklamationDocument {...input} />)
}
