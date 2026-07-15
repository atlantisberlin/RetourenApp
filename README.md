# Retouren-App

Tablet-Web-App für den Wareneingang bei Atlantis. Sucht Bestellungen aus Google BigQuery (Zentrallager), erfasst Retouren artikelgenau und legt strukturierte Aufgaben im Asana-Projekt „Retoureneingang" an.

## Screens

| Screen | Pfad | Funktion |
|---|---|---|
| Suche | `/` | Bestellung per Nummer oder Name finden |
| Bestellungsdetail | `/order/[id]` | Kunde, Positionen, Belegdaten |
| Erfassen | `/order/[id]/erfassen` | Pro Artikel: Menge, Zustand, Grund, Erstattung/Umtausch |
| Fotos | `/order/[id]/fotos` | Etikett, Retourenschein, Paket, Artikel fotografieren |
| Zusammenfassung | `/order/[id]/zusammenfassung` | Vorschau + Übermittlung an Asana |

## Demo-Modus

Ohne BigQuery- oder Asana-Konfiguration läuft die App automatisch im Demo-Modus mit Beispieldaten aus dem Tauchartikel-Sortiment (Zentrallager-Standins).

## Setup

```bash
npm install
cp .env.example .env.local
# .env.local befüllen (BigQuery + Asana)
npm run dev
```

## Umgebungsvariablen

Alle Variablen sind in `.env.example` dokumentiert. Wichtigste:

- `JWT_SECRET` — Signierschlüssel für Sessions & Geräte-Login (32+ Zeichen, in Produktion Pflicht)
- `DEVICE_ACCESS_CODE` — Zugangscode fürs Tablet (`/geraet-anmelden`), gilt einmalig pro Gerät für ~1 Jahr
- `GCP_SERVICE_ACCOUNT_JSON` — Service Account für BigQuery-Zugriff (als JSON-String)
- `BQ_PROJECT` — GCP-Projekt (Standard: `zentrallager`)
- `BQ_DATASET` — Dataset (Standard: `xanario_shop`)
- `ASANA_TOKEN` — Asana Personal Access Token
- `ASANA_PROJECT_GID` — GID des Projekts „Retoureneingang"

## BigQuery-Schema

Die App erwartet folgende Tabellen (konfigurierbar per Env-Var):

```sql
-- shop_orders
orders_id, customers_id, customers_name, customers_email_address,
date_purchased, orders_status

-- shop_order_products
orders_products_id, orders_id, products_id, products_name,
products_model, products_quantity, final_price
```

## Phasenplan

- **Phase 0 (aktiv):** Zentrallager-BigQuery vollständig abbilden + Asana-Token einrichten
- **Phase 1 (diese App):** Suche, Anzeige, Erfassung, Asana-Task
- **Phase 2:** Atlantis-Shop-Daten in BigQuery duplizieren
- **Phase 3:** Barcode-Scan, Asana Custom Fields, Auswertungen
