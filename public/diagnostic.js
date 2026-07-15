// Temporäres Diagnose-Skript, um herauszufinden, warum die App auf manchen
// Geräten nicht interaktiv wird. Läuft als eigenständige Datei (kein Inline-
// Script), damit es auch dann läuft, wenn CSP Inline-Scripts blockiert.
// Zeigt Fehler/CSP-Verstöße direkt auf dem Bildschirm an — kein USB/DevTools
// nötig. Nach der Fehlersuche wieder entfernen (Skript-Tag in layout.tsx +
// diese Datei).
(function () {
  var events = [];
  var box = null;

  function render() {
    if (!box) {
      box = document.createElement('div');
      box.id = '__diag_overlay';
      box.style.cssText =
        'position:fixed;top:0;left:0;right:0;z-index:2147483647;' +
        'background:#3a0d0d;color:#fff;font:12px/1.4 monospace;' +
        'max-height:60vh;overflow:auto;padding:8px 10px;' +
        'white-space:pre-wrap;word-break:break-word;';
      // Body existiert beim Laden dieses Skripts (steht am Ende von <head>,
      // aber wir hängen erst an, sobald der body da ist)
      if (document.body) document.body.appendChild(box);
      else
        document.addEventListener('DOMContentLoaded', function () {
          document.body.appendChild(box);
        });
    }
    box.textContent =
      '🔎 DIAGNOSE (' + events.length + ' Ereignis(se)) — bitte Screenshot senden:\n\n' +
      events.join('\n---\n');
  }

  function log(label, detail) {
    var ts = new Date().toISOString().split('T')[1].slice(0, 12);
    events.push('[' + ts + '] ' + label + '\n' + detail);
    render();
  }

  log('Skript gestartet', 'diagnostic.js läuft — JavaScript wird auf diesem Gerät grundsätzlich ausgeführt.');

  window.addEventListener('error', function (e) {
    log(
      'JS-FEHLER',
      (e.message || 'unbekannt') +
        '\nDatei: ' + (e.filename || '?') + ':' + (e.lineno || '?') + ':' + (e.colno || '?') +
        (e.error && e.error.stack ? '\nStack: ' + e.error.stack : '')
    );
  });

  window.addEventListener('unhandledrejection', function (e) {
    var reason = e.reason;
    log(
      'UNBEHANDELTE PROMISE-ABLEHNUNG',
      reason instanceof Error ? (reason.message + '\n' + (reason.stack || '')) : String(reason)
    );
  });

  document.addEventListener('securitypolicyviolation', function (e) {
    log(
      'CSP-VERSTOSS (Sicherheits-Regel blockiert etwas)',
      'Regel: ' + e.violatedDirective +
        '\nBlockiert: ' + e.blockedURI +
        '\nQuelle: ' + e.sourceFile + ':' + e.lineNumber
    );
  });

  // Nach 4 Sekunden prüfen, ob React überhaupt reagiert hat (grobe Heuristik:
  // gibt es mehr als nur den ursprünglichen Server-Text im Formular-Bereich?)
  setTimeout(function () {
    var hasHydrated = !!document.querySelector('[data-hydrated-marker]');
    log(
      'Status nach 4s',
      'Falls bis hier keine Fehler aufgetaucht sind, aber die Seite trotzdem nicht reagiert: ' +
        'React hat evtl. lautlos nicht gestartet (kein Fehler geworfen). ' +
        'hydrated-marker gefunden: ' + hasHydrated
    );
  }, 4000);
})();
