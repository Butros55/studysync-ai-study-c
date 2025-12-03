# Rate Limiting Improvements

## Zusammenfassung der Änderungen

Die 429-Fehler (Too Many Requests) wurden durch folgende Maßnahmen behoben:

### 1. Konservativere Rate Limits
- **Vorher**: 60 Anfragen pro Stunde
- **Jetzt**: 40 Anfragen pro Stunde (33% Reduktion)
- Dies gibt mehr Puffer, um GitHub's API-Limits nicht zu überschreiten

### 2. Längere Wartezeiten zwischen Anfragen
- **Vorher**: 4 Sekunden zwischen Aufgaben
- **Jetzt**: 8 Sekunden zwischen Aufgaben (100% Erhöhung)
- Bei Fehlern: Automatische Verlängerung der Wartezeit

### 3. Verbesserte Fehlerbehandlung
- Exponentieller Backoff bei Wiederholungsversuchen (2s, 4s, 8s, 16s, 32s)
- Intelligente Fehlererkennung für 429-Fehler
- Automatisches Pausieren bei mehreren aufeinanderfolgenden Fehlern

### 4. Proaktive Limitprüfung
- Vor jeder Anfrage wird geprüft, ob noch Kapazität vorhanden ist
- Bei weniger als 5 verbleibenden Anfragen: zusätzliche 3 Sekunden Wartezeit
- Bei 0 verbleibenden Anfragen: Fehlermeldung mit Wartezeit bis zum Reset

### 5. Visuelle Warnungen
- **Rate-Limit-Banner**: Erscheint automatisch bei niedrigem Limit
- **Rate-Limit-Indikator**: Zeigt verbleibende Anfragen und Reset-Zeit
- **Farbkodierung**:
  - Grün (>50%): Alles in Ordnung
  - Gelb (20-50%): Moderate Nutzung
  - Rot (<20%): Kritisches Limit

### 6. Manueller Reset
- Button zum Zurücksetzen des Zählers
- Nützlich, wenn das Limit fälschlicherweise erreicht wurde
- Zu finden im Rate-Limit-Indikator (oben rechts)

## Was tun bei 429-Fehlern?

1. **Warten**: Das Limit resettet automatisch nach 1 Stunde
2. **Reset-Button nutzen**: Manuelles Zurücksetzen im Rate-Limit-Indikator
3. **Weniger Batch-Operationen**: Nicht alle Skripte gleichzeitig verarbeiten
4. **Zeit zwischen Aktionen**: Warte 8-10 Sekunden zwischen manuellen Aktionen

## Technische Details

### Task Queue
```typescript
- Minimale Wartezeit: 8000ms (8 Sekunden)
- Bei Fehlern: Wartezeit × (Fehleranzahl + 1)
- Maximaler Backoff: 60000ms (1 Minute)
```

### LLM Retry Logic
```typescript
- Maximale Versuche: 5
- Backoff: 2s × 2^attempt (2s, 4s, 8s, 16s, 32s)
- Maximaler Backoff: 60s
- Zusätzlicher Jitter: 0-2s zufällig
```

### Rate Limit Tracking
```typescript
- Tracking-Fenster: 60 Minuten
- Maximale Anfragen: 40 pro Stunde
- Automatisches Reset: Nach 60 Minuten
- Persistenz: spark.kv Storage
```

## Best Practices

1. **Eine Aktion nach der anderen**: Lass Aufgaben in der Queue vollständig abarbeiten
2. **Skripte einzeln hochladen**: Nicht alle auf einmal
3. **Rate-Limit beobachten**: Nutze den Indikator oben rechts
4. **Bei Warnungen pausieren**: Wenn das Banner erscheint, warte mit weiteren Aktionen
5. **Reset nutzen**: Bei Unsicherheit den Zähler zurücksetzen

## Monitoring

Der Rate-Limit-Indikator zeigt:
- Verbleibende Anfragen in dieser Stunde
- Zeit bis zum automatischen Reset
- Farbcodierte Status-Warnung
- Detaillierte Informationen beim Klick

## Support

Falls weiterhin 429-Fehler auftreten:
1. Prüfe den Rate-Limit-Indikator
2. Warte mindestens 10 Minuten
3. Nutze den manuellen Reset
4. Reduziere die Anzahl paralleler Operationen
