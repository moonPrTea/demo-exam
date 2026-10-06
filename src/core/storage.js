import { normalizeConfig } from './generator.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateSession(session) {
  if (!record(session)) throw new Error('Invalid session');
  normalizeConfig(session.config);
  if (!['running', 'submitted', 'expired', 'interrupted'].includes(session.status)
    || typeof session.id !== 'string' || !finite(session.startedAt) || !finite(session.deadline)
    || session.deadline <= session.startedAt || session.deadline - session.startedAt > 240 * 60000
    || !Number.isInteger(session.minutes) || session.minutes < 1 || session.minutes > 240
    || !record(session.answers) || !Array.isArray(session.checks)
    || session.checks.some(i => !Number.isInteger(i) || i < 0 || i > 3)
    || new Set(session.checks).size !== session.checks.length
    || Object.values(session.answers).some(value => typeof value !== 'string' || value.length > 20)
    || (session.status !== 'running' && (!finite(session.finishedAt) || session.finishedAt < session.startedAt || session.finishedAt > session.deadline))) throw new Error('Invalid session');
  return session;
}

export function validateState(stored) {
  if (!record(stored) || stored.version !== 1 || !Array.isArray(stored.history) || !Array.isArray(stored.quizHistory)) throw new Error('Invalid saved state');
  normalizeConfig(stored.config);
  if (![';', ','].includes(stored.delimiter) || !Number.isInteger(stored.exports) || stored.exports < 0) throw new Error('Invalid settings');
  if (stored.session) validateSession(stored.session);
  stored.history.forEach(item => { validateSession(item); if (item.status === 'running') throw new Error('Unfinished history item'); });
  stored.quizHistory.forEach(item => {
    if (!finite(item.time) || typeof item.topic !== 'string' || !Number.isInteger(item.total) || item.total < 1 || item.total > 8
      || !Number.isInteger(item.correct) || item.correct < 0 || item.correct > item.total || !Number.isInteger(item.hints) || item.hints < 0 || item.hints > item.total) throw new Error('Invalid quiz history');
  });
  if (stored.quiz) {
    const q = stored.quiz;
    if (!Array.isArray(q.questions) || !q.questions.length || q.questions.length > 8 || !Array.isArray(q.answers)
      || q.answers.length > q.questions.length || typeof q.completed !== 'boolean' || typeof q.topic !== 'string'
      || q.completed !== (q.answers.length === q.questions.length)) throw new Error('Invalid quiz');
    q.questions.forEach(item => {
      if (['id', 'question', 'topic', 'explanation', 'hint'].some(k => typeof item[k] !== 'string') || !Array.isArray(item.options)
        || item.options.length !== 4 || item.options.some(o => typeof o !== 'string') || !Number.isInteger(item.correct) || item.correct < 0 || item.correct > 3) throw new Error('Invalid question');
    });
    [...q.answers, ...(q.pending ? [q.pending] : [])].forEach(item => {
      if (!Number.isInteger(item.choice) || item.choice < 0 || item.choice > 3 || typeof item.correct !== 'boolean' || typeof item.hint !== 'boolean') throw new Error('Invalid answer');
    });
  }
  return stored;
}
