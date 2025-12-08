/**
 * Middleware for room operations
 * 
 * Provides reusable middleware functions for room validation
 * to eliminate code duplication across room endpoints.
 */

/**
 * Middleware to validate and attach room to request
 * Looks up room by roomId parameter and returns 404 if not found
 */
export function validateRoomById(rooms) {
  return (req, res, next) => {
    const { roomId } = req.params;
    const room = rooms.get(roomId);

    if (!room) {
      return res.status(404).json({ error: "Room nicht gefunden" });
    }

    req.room = room;
    next();
  };
}

/**
 * Middleware to validate and attach member to request
 * Requires room to be already attached (use after validateRoomById)
 */
export function validateMember(req, res, next) {
  const { userId } = req.body || {};
  const room = req.room;

  if (!room) {
    return res.status(500).json({ error: "Internal error: room not loaded" });
  }

  const member = room.members.find((m) => m.userId === userId);
  if (!member) {
    return res.status(404).json({ error: "Mitglied nicht gefunden" });
  }

  req.member = member;
  next();
}

/**
 * Middleware to validate host authorization
 * Requires room to be already attached (use after validateRoomById)
 */
export function validateHost(req, res, next) {
  const { hostId } = req.body || {};
  const room = req.room;

  if (!room) {
    return res.status(500).json({ error: "Internal error: room not loaded" });
  }

  if (room.host.userId !== hostId) {
    return res.status(403).json({ error: "Nur der Host kann diese Aktion ausführen" });
  }

  next();
}

/**
 * Middleware to validate current round exists
 * Requires room to be already attached (use after validateRoomById)
 */
export function validateCurrentRound(req, res, next) {
  const room = req.room;

  if (!room?.currentRound) {
    return res.status(404).json({ error: "Keine laufende Runde gefunden" });
  }

  req.round = room.currentRound;
  next();
}
