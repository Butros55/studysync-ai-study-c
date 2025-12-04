# StudyMate - OpenAI Integration Setup

## Übersicht

Die App wurde so umgebaut, dass alle LLM-Anfragen über **deine eigene OpenAI-API** laufen, nicht mehr über GitHub Models/Spark Tools.

## Architektur

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Frontend  │  fetch  │   Backend   │   API   │   OpenAI    │
│  (React)    │────────>│  (Express)  │────────>│             │
│  Port 5000  │         │  Port 3001  │         │ gpt-4o-mini │
└─────────────┘         └─────────────┘         └─────────────┘
```

### Warum diese Architektur?

- **Sicherheit**: Der OpenAI API-Key bleibt ausschließlich auf dem Server, niemals im Browser
- **Kontrolle**: Du kannst das Modell zentral wechseln, Logging hinzufügen, Kosten überwachen
- **Rate Limiting**: Bessere Kontrolle über API-Aufrufe und Fehlerbehandlung

## Setup-Anleitung

### 1. OpenAI API-Key erhalten

1. Gehe zu [OpenAI Platform](https://platform.openai.com/api-keys)
2. Melde dich an oder erstelle einen Account
3. Navigiere zu "API Keys"
4. Klicke auf "Create new secret key"
5. Kopiere den Key (du siehst ihn nur einmal!)

### 2. Umgebungsvariablen konfigurieren

Erstelle eine `.env`-Datei im Projekt-Root:

```bash
cp .env.example .env
```

Öffne `.env` und füge deinen API-Key ein:

```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PORT=3001
```

⚠️ **WICHTIG**: Die `.env`-Datei ist in `.gitignore` und wird niemals commited!

### 3. Dependencies installieren

```bash
npm install
```

### 4. Beide Server starten

**Option A - Alles zusammen (empfohlen):**
```bash
npm run dev:full
```

**Option B - Einzeln in separaten Terminals:**

Terminal 1 (Backend):
```bash
npm run server
```

Terminal 2 (Frontend):
```bash
npm run dev
```

### 5. Verifizierung

Öffne http://localhost:5000 - die App sollte funktionieren!

Um zu testen, ob der Backend-Server läuft:
```bash
curl http://localhost:3001/api/health
```

Erwartete Antwort:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "apiKeyConfigured": true
}
```

## Geänderte Dateien

### Neu erstellt:
- `server/index.js` - Express Backend mit OpenAI Integration
- `.env.example` - Beispiel für Umgebungsvariablen
- `README_OPENAI.md` - Diese Datei

### Modifiziert:
- `src/lib/llm-utils.ts` - Ersetzt `spark.llm()` durch `fetch()` zu Backend
- `package.json` - Neue Scripts und Dependencies (openai, express, cors, concurrently)

### Unverändert (funktionieren weiterhin):
- Alle UI-Komponenten
- Rate Limiting Logik
- Task Queue System
- Debug Console
- Alle anderen Features

## Modell-Konfiguration

### Standard-Modell ändern

In `server/index.js`, Zeile 9:
```javascript
const DEFAULT_MODEL = 'gpt-4o-mini'  // ← Hier ändern
```

Verfügbare Modelle (Stand Jan 2024):
- `gpt-4o-mini` - Schnell, günstig, gut für die meisten Aufgaben (Standard)
- `gpt-4o` - Leistungsstärker, teurer
- `gpt-4-turbo` - Hohe Qualität
- `gpt-3.5-turbo` - Günstigste Option

### Modell pro Anfrage wählen

Im Frontend wird das Modell bei `llmWithRetry()` übergeben:
```typescript
// In App.tsx, z.B. Zeile 185
const response = await llmWithRetry(prompt, 'gpt-4o-mini', false)
```

## Fehlerbehandlung

### Backend meldet klare Fehler:

| HTTP Status | Fehler | Bedeutung |
|-------------|--------|-----------|
| 400 | Bad Request | Prompt fehlt im Request |
| 429 | Rate Limit | Zu viele Anfragen an OpenAI |
| 413 | Token Limit | Text ist zu lang für das Modell |
| 500 | Server Error | API-Key ungültig oder nicht gesetzt |

### Retry-Logik

- Standardmäßig **1 Retry** bei Fehlern
- Exponentielles Backoff (2s, 4s, 8s...)
- Bei 429: 5 Minuten Cooldown automatisch aktiviert

## Kosten-Übersicht

OpenAI berechnet nach Token-Verbrauch. Ungefähre Kosten (Stand Jan 2024):

| Modell | Input (pro 1M Tokens) | Output (pro 1M Tokens) |
|--------|----------------------|------------------------|
| gpt-4o-mini | $0.15 | $0.60 |
| gpt-4o | $2.50 | $10.00 |
| gpt-3.5-turbo | $0.50 | $1.50 |

**Beispiel**: Eine Notizgenerierung (~2000 Input + 500 Output Tokens) mit gpt-4o-mini kostet ca. $0.0006

## Debugging

### Backend-Logs

Der Server zeigt alle Requests:
```
[LLM] Request - Model: gpt-4o-mini, JSON Mode: false, Prompt length: 1234
[LLM] Response - Length: 567, Tokens: 234
```

### Frontend Debug-Konsole

Aktiviere den Debug-Modus in der App (Toggle oben rechts):
- Zeigt alle Prompts
- Zeigt alle Responses
- Zeigt Token-Verbrauch
- Zeigt Fehler mit Stack Trace

### Health Check

```bash
# Backend Status
curl http://localhost:3001/api/health

# Test LLM Request
curl -X POST http://localhost:3001/api/llm \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Was ist 2+2?", "model": "gpt-4o-mini"}'
```

## Häufige Probleme

### "Verbindung zum Backend fehlgeschlagen"

**Lösung**: Stelle sicher, dass der Backend-Server läuft:
```bash
npm run server
```

### "OPENAI_API_KEY nicht gesetzt"

**Lösung**: Erstelle `.env`-Datei mit deinem API-Key:
```bash
echo "OPENAI_API_KEY=sk-..." > .env
```

### "Rate Limit erreicht"

**Lösung**: 
1. Warte 5 Minuten (automatischer Cooldown)
2. Überprüfe dein OpenAI-Kontingent: https://platform.openai.com/usage
3. Evtl. zu `gpt-3.5-turbo` wechseln (höhere Limits)

### "Token-Limit überschritten"

**Lösung**: Das Dokument ist zu groß. Optionen:
1. Teile das Dokument in kleinere Abschnitte
2. Wechsle zu einem Modell mit größerem Context Window (`gpt-4-turbo`: 128k Tokens)

## Entwicklung

### Neue LLM-Features hinzufügen

1. **Im Frontend** (`src/lib/llm-utils.ts`):
```typescript
const response = await llmWithRetry(
  prompt,
  'gpt-4o-mini',  // Modell
  false,          // JSON Mode
  1               // Max Retries
)
```

2. **Backend erweitern** (`server/index.js`):
```javascript
// Z.B. Vision Support hinzufügen:
if (req.body.image) {
  requestOptions.messages[0].content = [
    { type: "text", text: prompt },
    { type: "image_url", image_url: { url: req.body.image } }
  ]
}
```

## Migration von GitHub Models

Alle Stellen, die vorher `spark.llm()` verwendet haben, nutzen jetzt:
1. `llmWithRetry()` im Frontend
2. Diese Funktion ruft `/api/llm` auf
3. Das Backend ruft OpenAI auf

**Keine Änderungen nötig** in:
- `App.tsx` - verwendet bereits `llmWithRetry()`
- Komponenten - keine direkten LLM-Calls
- UI-Logik - bleibt gleich

## Produktiv-Deployment

### Option 1: Gleicher Server (z.B. Vercel, Railway)

Stelle sicher, dass:
1. Beide Server starten: `npm run dev:full` (oder separates Prozess-Management)
2. `OPENAI_API_KEY` als Umgebungsvariable gesetzt ist
3. `VITE_API_URL` auf die Backend-URL zeigt

### Option 2: Separates Backend-Deployment

1. Backend auf separatem Service (z.B. Railway, Render, Fly.io)
2. Im Frontend `.env`:
```env
VITE_API_URL=https://your-backend-url.com
```

## Support

Bei Fragen oder Problemen:
1. Überprüfe die Logs in Backend (`npm run server`) und Browser-Console
2. Aktiviere Debug-Modus in der App
3. Überprüfe OpenAI Status: https://status.openai.com

## Sicherheit

✅ **Richtig implementiert:**
- API-Key nur auf Server
- CORS konfiguriert
- `.env` in `.gitignore`
- Input-Validierung im Backend

⚠️ **Für Produktion zusätzlich:**
- Rate Limiting pro User
- Request-Größen-Limit
- API-Key-Rotation
- Monitoring & Alerting
- Cost Limits in OpenAI Dashboard setzen
