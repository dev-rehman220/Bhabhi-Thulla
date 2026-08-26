const eventCounts = new Map<string, { count: number; resetAt: number }>();

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  play_card: { max: 30, windowMs: 10_000 },
  emoji_reaction: { max: 10, windowMs: 5_000 },
  join_room: { max: 8, windowMs: 10_000 },
  start_match: { max: 4, windowMs: 10_000 },
};

export function rateLimitEvent(socketId: string, event: string): boolean {
  const limit = LIMITS[event];
  if (!limit) {
    return true;
  }

  const key = `${socketId}:${event}`;
  const now = Date.now();
  const record = eventCounts.get(key);

  if (!record || now > record.resetAt) {
    eventCounts.set(key, { count: 1, resetAt: now + limit.windowMs });
    return true;
  }

  if (record.count >= limit.max) {
    return false;
  }

  record.count += 1;
  return true;
}
