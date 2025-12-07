import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { OpenAI } from "openai";
import { tasksDB } from "./database.js";

// TODO: persist rooms in a durable store if rooms need to survive restarts
const rooms = new Map();

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const EXTENSION_VOTE_RATIO = 0.5;
const openai =
  process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "demo"
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

const router = Router();

function generateRoomCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  // Ensure codes stay unique for the in-memory store
  if (Array.from(rooms.values()).some((room) => room.code === code)) {
    return generateRoomCode();
  }
  return code;
}

function findRoomByCode(code) {
  return Array.from(rooms.values()).find(
    (room) => room.code.toUpperCase() === code.toUpperCase()
  );
}

function computePoints(rank, correctCount, totalPlayers) {
  if (totalPlayers >= 4) {
    if (rank === 1) return 5;
    if (rank === 2) return 3;
    if (rank === 3) return 2;
    if (rank <= correctCount) return 1;
    return 0;
  }

  if (totalPlayers === 3) {
    if (rank === 1) return 4;
    if (rank === 2) return 2;
    return 1;
  }

  if (totalPlayers === 2) {
    return rank === 1 ? 3 : 1;
  }

  return 2;
}

function getBaseTimeSec(task) {
  switch (task?.difficulty) {
    case "easy":
      return 60;
    case "hard":
      return 300;
    case "medium":
    default:
      return 180;
  }
}

function sanitizePreview(text) {
  if (!text) return undefined;
  return text.length > 300 ? `${text.slice(0, 300)}…` : text;
}

function pickTaskForRound(moduleId, topic) {
  try {
    const allTasks = tasksDB?.getAll?.() || [];
    const candidates = allTasks.filter((task) => {
      const matchesModule = task.moduleId === moduleId;
      const topicLower = topic?.toLowerCase();
      const matchesTopic =
        !topic ||
        task.topic?.toLowerCase() === topicLower ||
        task.tags?.some((tag) => tag.toLowerCase() === topicLower);
      return matchesModule && matchesTopic;
    });

    const selected =
      candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : null;

    if (selected) {
      return {
        id: selected.id,
        moduleId: selected.moduleId,
        question: selected.question,
        solution:
          selected.solution ||
          selected.solutionMarkdown ||
          "Siehe Musterlösung aus dem Lernmodus.",
        difficulty: selected.difficulty || "medium",
        topic: selected.topic || topic || "Allgemein",
        tags: selected.tags || [],
      };
    }
  } catch (error) {
    console.warn("[StudyRoom] Failed to pick existing task for round:", error);
  }

  return null;
}

async function generateTaskWithLLM(moduleId, topic, moduleMeta) {
  if (!openai) return null;
  const safeTopic = topic || moduleMeta?.topic || moduleMeta?.moduleTitle || "Allgemein";
  const tagList = Array.isArray(moduleMeta?.moduleTags)
    ? moduleMeta.moduleTags.join(", ")
    : "";
  const sampleBlock =
    moduleMeta?.sampleTasks && moduleMeta.sampleTasks.length
      ? moduleMeta.sampleTasks
          .slice(0, 3)
          .map(
            (t, idx) =>
              `### Sample ${idx + 1}\nFrage: ${t.question}\nSchwierigkeit: ${
                t.difficulty || "medium"
              }\nTags: ${(t.tags || []).join(", ")}`
          )
          .join("\n\n")
      : "";

  const prompt = `Erstelle EINE kurze Übungsaufgabe für ein Challenge-Duell.
Module title: ${moduleMeta?.moduleTitle || moduleId}
Tags/Topics: ${tagList}
Focus topic: ${safeTopic}
Language: Deutsch
Samples (zur Stil-Referenz, KEINE Lösungen): 
${sampleBlock || "- keine Samples vorhanden -"}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Du bist ein Dozent. Erstelle realistische, kurze Übungsaufgaben mit klarer Musterlösung.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 600,
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      id: uuidv4(),
      moduleId,
      question: parsed.question,
      solution: parsed.solution,
      difficulty: parsed.difficulty || "medium",
      topic: parsed.topic || safeTopic,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [safeTopic],
      solutionMarkdown: parsed.solutionMarkdown || parsed.solution,
    };
  } catch (error) {
    console.warn("[StudyRoom] LLM task generation failed, falling back:", error);
    return null;
  }
}

async function resolveRoundTask(moduleId, topic, moduleMeta) {
  const existing = pickTaskForRound(moduleId, topic);
  if (existing) return existing;
  const generated = await generateTaskWithLLM(moduleId, topic, moduleMeta);
  if (generated) return generated;
  const safeTopic = topic || "Allgemein";
  return {
    id: uuidv4(),
    moduleId,
    question: `Diskutiere kurz das Thema "${safeTopic}" aus deinem Modul und nenne zwei Kernpunkte.`,
    solution: `Kernpunkte zu ${safeTopic} skizzieren (Stichpunkte ausreichend).`,
    difficulty: "medium",
    topic: safeTopic,
    tags: safeTopic ? [safeTopic] : [],
    solutionMarkdown: `Diskutiere ${safeTopic}.`,
    fallback: true,
  };
}

function computeRoundPhase(round) {
  if (!round) return;
  const now = Date.now();
  if (round.phase === "starting" && round.startsAt) {
    if (now >= new Date(round.startsAt).getTime()) {
      round.phase = "running";
    }
  }
  if (round.phase === "running" && round.endsAt) {
    if (now >= new Date(round.endsAt).getTime()) {
      round.phase = "ending";
    }
  }
}

function shouldEarlyFinish(round, members) {
  if (!round) return false;
  const allSubmitted =
    round.submissions.length > 0 &&
    members.every((m) => round.submissions.some((s) => s.userId === m.userId));
  return allSubmitted;
}

async function evaluateRound(room) {
  const round = room.currentRound;
  if (!round) return;
  round.evaluation = { status: "pending" };

  const submissions = [...round.submissions];
  const perUser = {};
  let summaryMarkdown = "Kurze Auswertung.";

  if (openai && round.task?.solutionMarkdown) {
    const answerBlock = submissions
      .map(
        (s) =>
          `User: ${s.userId}\nAntwort: ${s.answerText || s.answerPreview || "—"}\n\n`
      )
      .join("\n");
    const evalPrompt = `Bewerte die Antworten einer Challenge-Aufgabe. Gib JSON zurück:
{
  "summaryMarkdown": "kurze Zusammenfassung",
  "perUser": {
    "<userId>": { "correct": true/false, "feedbackMarkdown": "kurzes Feedback", "scoreHint": "Hinweis" }
  }
}

Aufgabe:
${round.task.question}

Offizielle Lösung:
${round.task.solutionMarkdown || round.task.solution}

Antworten:
${answerBlock}`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: evalPrompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 600,
      });
      const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
      if (parsed.perUser) Object.assign(perUser, parsed.perUser);
      if (parsed.summaryMarkdown) summaryMarkdown = parsed.summaryMarkdown;
    } catch (error) {
      console.warn("[StudyRoom] evaluation LLM failed:", error);
      round.evaluation = { status: "error", error: "Auswertung fehlgeschlagen" };
    }
  }

  // Mark correctness & points
  const correctSubs = submissions
    .map((s) => {
      const verdict = perUser[s.userId]?.correct;
      const correct = verdict === undefined ? true : !!verdict;
      return { ...s, isCorrect: correct };
    })
    .filter((s) => s.isCorrect)
    .sort(
      (a, b) =>
        new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
    );

  correctSubs.forEach((submission, index) => {
    const rank = index + 1;
    const points = computePoints(rank, correctSubs.length, room.members.length);
    submission.rank = rank;
    submission.pointsAwarded = points;
    room.scoreboard[submission.userId] =
      (room.scoreboard[submission.userId] || 0) + points;
  });

  round.submissions = submissions;
  round.evaluation = { status: "done", result: { summaryMarkdown, perUser } };
  round.phase = "review";
  round.state = "ended";
  round.endedAt = new Date().toISOString();
  room.members.forEach((member) => {
    member.status = "idle";
    member.ready = false;
  });
}

async function autoEndIfNeeded(room) {
  const round = room.currentRound;
  if (!round) return;
  computeRoundPhase(round);
  const now = Date.now();

  if (round.phase === "running" && round.endsAt) {
    const lockActive =
      round.lockCountdownStartAt &&
      now - new Date(round.lockCountdownStartAt).getTime() >= 5000;
    const timeOver = now >= new Date(round.endsAt).getTime();
    if (timeOver || lockActive) {
      round.phase = "ending";
      round.state = "ended";
      round.endedAt = new Date().toISOString();
      await evaluateRound(room);
    }
  }
}

function updateMemberLastSeen(room, userId) {
  const member = room.members.find((m) => m.userId === userId);
  if (member) {
    member.lastSeenAt = new Date().toISOString();
  }
}

router.post("/", (req, res) => {
  const { moduleId, topic, nickname, userId, moduleMeta } = req.body || {};

  if (!moduleId || !nickname || !userId) {
    return res.status(400).json({
      error: "moduleId, nickname und userId werden benötigt",
    });
  }

  const now = new Date().toISOString();
  const roomId = uuidv4();
  const code = generateRoomCode();
  const hostMember = {
    userId,
    nickname,
    joinedAt: now,
    lastSeenAt: now,
    ready: false,
    status: "idle",
  };

  const room = {
    id: roomId,
    code,
    moduleId,
    topic,
    createdAt: now,
    host: { userId, nickname },
    members: [hostMember],
    state: "lobby",
    currentRound: undefined,
    rounds: [],
    scoreboard: {},
    moduleMeta,
  };

  rooms.set(roomId, room);
  res.json({ room });
});

router.post("/join", (req, res) => {
  const { code, nickname, userId, moduleMeta } = req.body || {};
  if (!code || !nickname || !userId) {
    return res.status(400).json({
      error: "code, nickname und userId werden benötigt",
    });
  }

  const room = findRoomByCode(code);
  if (!room) {
    return res.status(404).json({ error: "Room nicht gefunden" });
  }

  const now = new Date().toISOString();
  const existing = room.members.find((m) => m.userId === userId);
  if (existing) {
    existing.nickname = nickname;
    existing.lastSeenAt = now;
    existing.status = existing.status || "idle";
  } else {
    room.members.push({
      userId,
      nickname,
      joinedAt: now,
      lastSeenAt: now,
      ready: false,
      status: "idle",
    });
  }

  if (moduleMeta) {
    room.moduleMeta = moduleMeta;
  }

  res.json({ room });
});

router.get("/:roomId", (req, res) => {
  const { roomId } = req.params;
  const { userId } = req.query;
  const room = rooms.get(roomId);

  if (!room) {
    return res.status(404).json({ error: "Room nicht gefunden" });
  }

  autoEndIfNeeded(room).catch((err) =>
    console.warn("[StudyRoom] autoEnd polling failed", err)
  );

  if (userId) {
    updateMemberLastSeen(room, String(userId));
  }

  res.json({ room });
});

router.post("/:roomId/ready", (req, res) => {
  const { roomId } = req.params;
  const { userId, ready } = req.body || {};
  const room = rooms.get(roomId);

  if (!room) {
    return res.status(404).json({ error: "Room nicht gefunden" });
  }

  const member = room.members.find((m) => m.userId === userId);
  if (!member) {
    return res.status(404).json({ error: "Mitglied nicht gefunden" });
  }

  member.ready = !!ready;
  member.status = ready ? "ready" : "idle";
  res.json({ room });
});

router.post("/:roomId/start-round", async (req, res) => {
  try {
    const { roomId } = req.params;
    const { hostId, mode, moduleMeta } = req.body || {};
    const room = rooms.get(roomId);

    if (!room) {
      return res.status(404).json({ error: "Room nicht gefunden" });
    }

    if (room.host.userId !== hostId) {
      return res.status(403).json({ error: "Nur der Host kann Runden starten" });
    }

    if (!["collab", "challenge"].includes(mode)) {
      return res.status(400).json({ error: "Ungültiger Rundentyp" });
    }

    if (moduleMeta) {
      room.moduleMeta = moduleMeta;
    }

    const startsAt = new Date(Date.now() + 3000).toISOString();
    const roundTask = await resolveRoundTask(room.moduleId, room.topic, room.moduleMeta);
    const baseTimeSec = getBaseTimeSec(roundTask);

    const round = {
      id: uuidv4(),
      roundIndex: room.rounds.length + 1,
      mode,
      task: roundTask,
      phase: mode === "challenge" ? "starting" : "running",
      startsAt,
      startedAt: startsAt,
      endsAt: new Date(
        new Date(startsAt).getTime() + baseTimeSec * 1000
      ).toISOString(),
      extended: false,
      state: "running",
      baseTimeSec,
      submissions: [],
      extensionVotes: [],
      evaluation: { status: "idle" },
    };

    room.currentRound = round;
    room.rounds.push(round);
    room.state = "running";
    room.members.forEach((member) => {
      member.status = "solving";
      member.ready = false;
    });

    res.json({ room, round });
  } catch (error) {
    console.error("[StudyRoom] start-round failed:", error);
    res.status(500).json({ error: "Konnte Runde nicht starten" });
  }
});

router.post("/:roomId/vote-extension", (req, res) => {
  const { roomId } = req.params;
  const { userId } = req.body || {};
  const room = rooms.get(roomId);

  if (!room?.currentRound) {
    return res.status(404).json({ error: "Keine laufende Runde gefunden" });
  }

  const round = room.currentRound;
  if (round.mode !== "challenge" || round.state !== "running") {
    return res
      .status(400)
      .json({ error: "Verlängerung nur in laufenden Challenges erlaubt" });
  }

  if (!round.extensionVotes.includes(userId)) {
    round.extensionVotes.push(userId);
  }

  const votersNeeded = Math.ceil(room.members.length * EXTENSION_VOTE_RATIO);
  if (!round.extended && round.extensionVotes.length >= votersNeeded) {
    const extra = Math.max(60, Math.round(round.baseTimeSec * 0.5));
    round.extendedTimeSec = extra;
    round.endsAt = new Date(
      new Date(round.endsAt || round.startedAt).getTime() + extra * 1000
    ).toISOString();
    round.extended = true;
  }

  res.json({ room });
});

router.post("/:roomId/submit", (req, res) => {
  const { roomId } = req.params;
  const { userId, isCorrect, answerPreview, answerText } = req.body || {};
  const room = rooms.get(roomId);

  if (!room?.currentRound) {
    return res.status(404).json({ error: "Keine laufende Runde gefunden" });
  }

  const member = room.members.find((m) => m.userId === userId);
  if (!member) {
    return res.status(404).json({ error: "Mitglied nicht gefunden" });
  }

  const now = new Date().toISOString();
  const round = room.currentRound;
  const timeMs = new Date(now).getTime() - new Date(round.startedAt).getTime();
  const preview = sanitizePreview(answerPreview || answerText);

  const existing = round.submissions.find((s) => s.userId === userId);
  if (existing) {
    existing.submittedAt = now;
    existing.isCorrect = isCorrect;
    existing.timeMs = timeMs;
    existing.answerPreview = preview;
    existing.answerText = answerText;
  } else {
    round.submissions.push({
      userId,
      submittedAt: now,
      isCorrect,
      timeMs,
      answerPreview: preview,
      answerText,
    });
  }

  member.status = "submitted";

  if (shouldEarlyFinish(round, room.members)) {
    round.lockCountdownStartAt = round.lockCountdownStartAt || now;
  } else {
    round.lockCountdownStartAt = undefined;
  }

  res.json({ room, round });
});

router.post("/:roomId/unsubmit", (req, res) => {
  const { roomId } = req.params;
  const { userId } = req.body || {};
  const room = rooms.get(roomId);

  if (!room?.currentRound) {
    return res.status(404).json({ error: "Keine laufende Runde gefunden" });
  }

  const member = room.members.find((m) => m.userId === userId);
  if (!member) {
    return res.status(404).json({ error: "Mitglied nicht gefunden" });
  }

  const round = room.currentRound;
  round.submissions = round.submissions.filter((s) => s.userId !== userId);
  member.status = "solving";
  round.lockCountdownStartAt = undefined;
  res.json({ room, round });
});

router.post("/:roomId/end-round", (req, res) => {
  const { roomId } = req.params;
  const { hostId } = req.body || {};
  const room = rooms.get(roomId);

  if (!room?.currentRound) {
    return res.status(404).json({ error: "Keine laufende Runde gefunden" });
  }

  if (room.host.userId !== hostId) {
    return res.status(403).json({ error: "Nur der Host kann die Runde beenden" });
  }

  const round = room.currentRound;
  round.state = "ended";
  round.phase = "ending";
  round.endedAt = new Date().toISOString();

  evaluateRound(room).then(() => {
    room.members.forEach((member) => {
      member.status = "idle";
      member.ready = false;
    });
  });

  res.json({ room, round });
});

router.post("/:roomId/leave", (req, res) => {
  const { roomId } = req.params;
  const { userId } = req.body || {};
  const room = rooms.get(roomId);

  if (!room) {
    return res.status(404).json({ error: "Room nicht gefunden" });
  }

  room.members = room.members.filter((m) => m.userId !== userId);
  res.json({ room });
});

export const roomsRouter = router;
