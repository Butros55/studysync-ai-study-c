# Rate Limiting & Error Handling Improvements

## Zusammenfassung der neuesten Änderungen (v2)

Die 429-Fehler (Too Many Requests) und Token-Limit-Fehler wurden durch folgende Maßnahmen behoben:

### 1. Korrektes Modell verwenden
- **Problem**: Verwendung des nicht-existenten Modells `gpt-5`
- **Lösung**: Standardmodell ist jetzt `gpt-4o`
- **Vorteil**: 
  - `gpt-4o` hat ein Token-Limit von **128.000 Tokens** (statt 8.000)
  - Besser für lange Dokumente und Skripte geeignet
  - Höhere Qualität der Antworten

### 2. Konservativere Rate Limits
- **Vorher**: 40 Anfragen pro Stunde
- **Jetzt**: 30 Anfragen pro Stunde (25% Reduktion)
- Dies gibt mehr Puffer, um GitHub's API-Limits nicht zu überschreiten

### 3. Verbesserte Fehlerbehandlung
- **Rate Limit Fehler**: Sofortiger Abbruch mit klarer Fehlermeldung
- **Token Limit Fehler**: Spezielle Fehlermeldung für zu lange Dokumente
- **Keine unnötigen Retries**: Nur 1 Versuch bei Rate-Limit-Fehlern
- Exponentieller Backoff bei Wiederholungsversuchen (2s, 4s, 8s, 16s)

### 4. Token-Limit-Fehler beheben
Wenn du den Fehler "Token-Limit erreicht" bekommst:

1. **Dokument aufteilen**: Teile große PDFs/PPTX in kleinere Teile
2. **Kürzere Skripte**: Lade nur relevante Seiten hoch
3. **Zusammenfassungen**: Nutze Zusammenfassungen statt komplette Dokumente

### 5. Proaktive Limitprüfung
- Vor jeder Anfrage wird geprüft, ob noch Kapazität vorhanden ist
- Bei weniger als 10 verbleibenden Anfragen: zusätzliche 2-5 Sekunden Wartezeit
- Bei 0 verbleibenden Anfragen: Fehlermeldung mit Wartezeit bis zum Reset

### 6. Debug-Konsole Verbesserungen
- **Kein horizontales Scrollen mehr**: Alle Texte werden automatisch umgebrochen
- **Lesbare Fehler**: Stack Traces und lange Texte sind vollständig sichtbar
- **Word-Wrap**: Alle Code-Blöcke nutzen `break-words` für bessere Lesbarkeit

## Was tun bei Fehlern?

### 429 (Rate Limit) Fehler
1. **Warten**: Das Limit resettet automatisch nach 1 Stunde
2. **Rate-Limit-Indikator prüfen**: Oben rechts siehst du, wann der Reset ist
3. **Weniger Aktionen**: Nicht alle Skripte gleichzeitig verarbeiten
4. **Zeit zwischen Aktionen**: Warte 10-15 Sekunden zwischen manuellen Aktionen

### Token-Limit Fehler
1. **Dokument kürzen**: Reduziere die Länge des Dokuments
2. **Aufteilen**: Lade das Dokument in mehreren Teilen hoch
3. **Text extrahieren**: Bei PDFs nur relevante Seiten hochladen

## Best Practices

1. **Eine Aktion nach der anderen**: Lass Aufgaben in der Queue vollständig abarbeiten
2. **Skripte einzeln hochladen**: Nicht alle auf einmal
3. **Rate-Limit beobachten**: Nutze den Indikator oben rechts
4. **Bei Warnungen pausieren**: Wenn das Banner erscheint, warte mit weiteren Aktionen
5. **Kürzere Dokumente**: Teile große Dokumente in kleinere Abschnitte

## Technische Details

### Modellauswahl
```typescript
- Standard-Modell: gpt-4o (128k Tokens)
- Fallback: gpt-4o-mini (8k Tokens) - nur bei Bedarf
- JSON-Modus: Aktiviert für strukturierte Ausgaben
```

### Rate Limit Tracking
```typescript
- Tracking-Fenster: 60 Minuten
- Maximale Anfragen: 30 pro Stunde
- Automatisches Reset: Nach 60 Minuten
- Persistenz: spark.kv Storage
```

### LLM Retry Logic
```typescript
- Standard-Versuche: 1 (keine Retries bei Rate-Limit)
- Bei anderen Fehlern: Sofortiger Fehler mit Details
- Wartezeiten: 2-5 Sekunden bei niedrigem Limit
```

## Monitoring

Der Rate-Limit-Indikator zeigt:
- Verbleibende Anfragen in dieser Stunde
- Zeit bis zum automatischen Reset
- Farbcodierte Status-Warnung
- Detaillierte Informationen beim Klick

Die Debug-Konsole zeigt:
- Alle API-Anfragen und -Antworten
- Vollständige Fehlermeldungen mit Stack Traces
- Token-Informationen und Modell-Details
- Kein horizontales Scrollen mehr

## Support

Falls weiterhin Fehler auftreten:
1. Prüfe den Rate-Limit-Indikator (oben rechts)
2. Öffne die Debug-Konsole für Details (Debug-Modus aktivieren)
3. Warte mindestens 10 Minuten bei Rate-Limit-Fehlern
4. Teile große Dokumente in kleinere Teile bei Token-Limit-Fehlern
