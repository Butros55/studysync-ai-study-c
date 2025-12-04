import express from 'express'
import cors from 'cors'
import { OpenAI } from 'openai'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '10mb' }))

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const DEFAULT_MODEL = 'gpt-4o-mini'

app.post('/api/llm', async (req, res) => {
  try {
    const { prompt, model = DEFAULT_MODEL, jsonMode = false } = req.body

    if (!prompt) {
      return res.status(400).json({ 
        error: 'Prompt ist erforderlich',
        details: 'Der Request muss ein "prompt"-Feld enthalten'
      })
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ 
        error: 'Server-Konfigurationsfehler',
        details: 'OPENAI_API_KEY Umgebungsvariable ist nicht gesetzt'
      })
    }

    console.log(`[LLM] Request - Model: ${model}, JSON Mode: ${jsonMode}, Prompt length: ${prompt.length}`)

    const requestOptions = {
      model: model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
    }

    if (jsonMode) {
      requestOptions.response_format = { type: 'json_object' }
    }

    const completion = await openai.chat.completions.create(requestOptions)

    const responseText = completion.choices[0]?.message?.content || ''
    
    console.log(`[LLM] Response - Length: ${responseText.length}, Tokens: ${completion.usage?.total_tokens || 'N/A'}`)

    res.json({ 
      response: responseText,
      usage: completion.usage,
      model: completion.model
    })

  } catch (error) {
    console.error('[LLM] Error:', error)

    if (error.status === 429) {
      return res.status(429).json({ 
        error: 'Rate Limit erreicht',
        details: 'Zu viele Anfragen an OpenAI. Bitte warte einen Moment und versuche es erneut.',
        retryAfter: error.headers?.['retry-after'] || 60
      })
    }

    if (error.code === 'context_length_exceeded') {
      return res.status(413).json({ 
        error: 'Token-Limit überschritten',
        details: 'Der Text ist zu lang für dieses Modell. Bitte teile ihn in kleinere Abschnitte auf.',
        maxTokens: error.message.match(/\d+/)?.[0] || 'unbekannt'
      })
    }

    if (error.code === 'invalid_api_key') {
      return res.status(500).json({ 
        error: 'Ungültiger API-Key',
        details: 'Der OpenAI API-Key ist ungültig. Bitte überprüfe die Konfiguration.'
      })
    }

    res.status(error.status || 500).json({ 
      error: error.message || 'Unbekannter Fehler',
      details: error.toString(),
      code: error.code
    })
  }
})

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    apiKeyConfigured: !!process.env.OPENAI_API_KEY
  })
})

app.listen(PORT, () => {
  console.log(`🚀 StudyMate Backend läuft auf Port ${PORT}`)
  console.log(`📡 LLM Endpoint: http://localhost:${PORT}/api/llm`)
  console.log(`🔑 OpenAI API-Key: ${process.env.OPENAI_API_KEY ? '✓ Konfiguriert' : '✗ Nicht gesetzt'}`)
})
