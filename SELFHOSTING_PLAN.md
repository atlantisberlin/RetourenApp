# 🖥️ Umzug von Vercel auf eigenen Server (IONOS)

**Status:** Geplant, noch nicht begonnen.
**Grund für den Umzug:** Datenschutz — App und Daten sollen auf eigener Infrastruktur laufen statt bei Vercel (US-Anbieter).
**Wann:** Bewusst zurückgestellt, bis die RetourenApp inhaltlich/funktional weitgehend fertig ist. Erst grobe Probleme in der App selbst lösen, danach den Umzug angehen.

---

## Ausgangslage

- Aktuell läuft die App auf Vercel: Hosting, HTTPS, Deploy, Logs, Umgebungsvariablen — alles über das Vercel-Dashboard.
- Firma hat bereits **zwei eigene Server bei IONOS**.
- Es gibt (oder wird geben) **mehrere interne Apps** — aktuell RetourenApp, dazu kommt eine Messe-App, evtl. weitere später. Die Lösung soll nicht nur für eine App gebaut werden, sondern für alle gemeinsam funktionieren.

## Gewählter Ansatz: Coolify (self-hosted PaaS)

Statt alles einzeln von Hand einzurichten (Reverse-Proxy, HTTPS-Zertifikate, Deploy-Skripte, Log-Sammlung …), nutzen wir **Coolify** — eine Open-Source-Plattform, die man auf den eigenen Servern installiert und die sich wie eine selbstgehostete Vercel-Alternative verhält.

Coolify übernimmt:
- **Deploy:** Git-Push → automatisch neu bauen & ausrollen (wie bisher bei Vercel)
- **HTTPS:** automatische Let's-Encrypt-Zertifikate pro App/Subdomain
- **Verstecken der Apps:** nur der Reverse-Proxy ist von außen erreichbar, jede App läuft intern in einem eigenen Docker-Container
- **Umgebungsvariablen:** zentrale Verwaltung pro App über die Weboberfläche
- **Logs:** pro App einsehbar in der Coolify-Oberfläche
- **Mehrere Server:** ein Server hostet Coolify selbst (Steuerung), der zweite Server lässt sich als zusätzliches Ziel verbinden — Apps lassen sich frei auf einen der beiden Server verteilen

Alternativen, falls Coolify sich als ungeeignet herausstellt: **CapRover** (ähnliches Prinzip, etwas älter) oder händisch **Traefik + Portainer** (mehr Kontrolle, mehr Aufwand).

---

## Was im Repo bereits vorbereitet ist

- [`Dockerfile`](Dockerfile) — Multi-Stage-Build, nutzt Next.js' `standalone`-Output für ein schlankes Produktions-Image
- [`.dockerignore`](.dockerignore) — schließt `node_modules`, `.env*`, `.next` etc. vom Docker-Build aus
- [`next.config.ts`](next.config.ts) — `output: 'standalone'` gesetzt (Voraussetzung für den schlanken Docker-Build)

Diese drei Dateien reichen aus, damit Coolify (oder jedes andere Docker-basierte System) die App direkt bauen kann, sobald der Umzug ansteht.

---

## Rollenverteilung der zwei IONOS-Server

- **Server A** = Coolify-Hauptserver (Steuerung + Apps)
- **Server B** = wird in Coolify als zusätzlicher Server verbunden, kann Apps übernehmen (z. B. Messe-App) oder als Ausweich dienen

*Offene Fragen, die vor dem Start zu klären sind:*
- Welches Betriebssystem läuft auf den Servern? (Coolify braucht Ubuntu 22.04/24.04 oder Debian 11/12, mit Root-Zugriff)
- Ist bereits eine Domain vorhanden, die auf die Server zeigen kann (z. B. `retouren.eure-domain.de`, `messe.eure-domain.de`)?

---

## Schritt-für-Schritt-Ablauf (wenn es soweit ist)

### 1. Coolify auf Server A installieren
Per SSH auf Server A einloggen, dann:
```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```
Installiert Docker + Coolify automatisch. Am Ende erscheint eine Adresse wie `http://<server-ip>:8000` — dort im Browser den Admin-Zugang mit starkem Passwort anlegen.

### 2. Domain/DNS einrichten
Bei eurem Domain-Anbieter je App einen A-Record auf Server A's IP anlegen:
- `retouren.eure-domain.de` → Server A
- `messe.eure-domain.de` → Server A (oder später Server B)

Coolify erstellt danach automatisch HTTPS-Zertifikate (Let's Encrypt) pro Subdomain.

### 3. Server B verbinden
Coolify-Oberfläche → „Servers" → „Add Server" → IP von Server B eintragen. Coolify erzeugt einen SSH-Schlüssel, der auf Server B hinterlegt wird. Danach lässt sich pro App wählen, auf welchem Server sie läuft.

### 4. RetourenApp als „Application" anlegen
Coolify → „New Resource" → „Application" → GitHub-Repo verbinden → Branch wählen (`staging`/`main`) → Dockerfile wird automatisch erkannt → Domain eintragen (`retouren.eure-domain.de`).

Danach alle Umgebungsvariablen eintragen (siehe Checkliste unten). Bei den GCP-Zugangsdaten kann jetzt die **echte Schlüssel-Datei hochgeladen** werden (`GOOGLE_APPLICATION_CREDENTIALS`) statt des JSON-Text-Umwegs, den Vercel nötig gemacht hat — sauberer und ist bereits so in `.env.example` als empfohlener Weg dokumentiert.

„Deploy" klicken, danach „Auto Deploy" aktivieren (Push → automatischer Neustart, wie bisher bei Vercel).

### 5. Messe-App genauso
Gleicher Ablauf: eigene „Application" in Coolify, eigene Domain, eigener Server (A oder B) — alles über dieselbe Oberfläche, inkl. eigenem Logs-Tab pro App.

### 6. Umzug ohne Risiko (Cutover)
- Vercel währenddessen weiterlaufen lassen
- Neue Version auf Coolify gründlich testen: Suche, Retoure anlegen, Fotos hochladen, BigQuery-Zugriff, Asana-Verbindung, Geräte-Login (`/geraet-anmelden`)
- Erst danach DNS von Vercel auf die neue Adresse umstellen
- Vercel-Deployment noch ein paar Tage als Rückfalloption stehen lassen, bevor es gelöscht wird

---

## Umgebungsvariablen-Checkliste für Coolify

Alle Werte aus [`.env.example`](.env.example) müssen in Coolify pro App hinterlegt werden:

- `JWT_SECRET` (32+ Zeichen, siehe `.env.example` zur Erzeugung)
- `DEVICE_ACCESS_CODE` (langer, zufälliger Geräte-Zugangscode, keine PIN)
- `GOOGLE_APPLICATION_CREDENTIALS` (Pfad — echte Schlüssel-Datei ins Coolify-Dateisystem legen, nicht mehr `GCP_SERVICE_ACCOUNT_JSON`-Umweg nötig)
- `BQ_PROJECT`, `BQ_DATASET`, alle `BQ_TABLE_*`-Variablen
- `ASANA_TOKEN`, `ASANA_PROJECT_GID`, `ASANA_VERSAND_PROJECT_GID`, `ASANA_DHL_TAG_GID`, `ASANA_AMAZON_TAG_GID`, `ASANA_EBAY_TAG_GID`, `ASANA_ERSTATTUNG_TAG_GID`, `ASANA_UMTAUSCH_TAG_GID`

---

## Zusammenhang mit der Sicherheits-Härtung

Dieser Umzug hängt mit den offenen Punkten in [`SECURITY_CHECKLIST.md`](SECURITY_CHECKLIST.md) zusammen — insbesondere Security-Headers, CSRF, HTTPS-Erzwingung und Rate-Limiting sollten idealerweise **vor** dem Produktivbetrieb auf dem eigenen Server stehen, nicht erst danach nachgezogen werden.

---

**Zuletzt aktualisiert:** 2026-07-13
