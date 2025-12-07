# ✨ Welcome to Your Spark Template!
You've just launched your brand-new Spark Template Codespace — everything’s fired up and ready for you to explore, build, and create with Spark!

This template is your blank canvas. It comes with a minimal setup to help you get started quickly with Spark development.

🚀 What's Inside?
- A clean, minimal Spark environment
- Pre-configured for local development
- Ready to scale with your ideas
  
🧠 What Can You Do?

Right now, this is just a starting point — the perfect place to begin building and testing your Spark applications.

🧹 Just Exploring?
No problem! If you were just checking things out and don’t need to keep this code:

- Simply delete your Spark.
- Everything will be cleaned up — no traces left behind.

📄 License For Spark Template Resources 

The Spark Template files and resources from GitHub are licensed under the terms of the MIT license, Copyright GitHub, Inc.

## StudyRoom (Lerngruppen-Modus) – MVP Flow

- Modul öffnen, im Dashboard „Lerngruppe starten” oder per Code beitreten (Nickname/User-ID bleiben lokal gespeichert).
- Lobby zeigt Mitglieder, Ready-Status und Host-Aktionen (Collab oder Challenge starten).
- Alle öffnen die gemeinsame Aufgabe im Solve-UI; Abgaben werden per `/api/rooms/:roomId/submit` gespeichert.
- Challenge: nach `/end-round` Punktevergabe und Scoreboard-Update, basierend auf Einsendungen.
- Polling (2–3s) synchronisiert Mitglieder, Timer, Votes, Scoreboard. TODO: WebSockets/SSE für echtes Realtime.

