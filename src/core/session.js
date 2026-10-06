export function startSession(config, minutes, now = Date.now()) {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) throw new Error('Выбери время от 1 до 240 минут.');
  return { id: `run-${now}`, config, minutes, startedAt: now, deadline: now + minutes * 60000, status: 'running', answers: {}, checks: [], exported: false };
}

export function remainingMs(session, now = Date.now()) {
  if (!session) return 0;
  return Math.max(0, session.deadline - (session.finishedAt ?? now));
}

export function finishSession(session, now = Date.now(), interrupted = false) {
  if (session.status !== 'running') return session;
  const expired = now >= session.deadline;
  return { ...session, status: interrupted ? 'interrupted' : expired ? 'expired' : 'submitted', finishedAt: Math.min(now, session.deadline) };
}

export function formatTime(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
