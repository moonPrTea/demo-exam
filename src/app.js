import { domains, generateDataset, normalizeConfig, exportFiles, gradeTasks, checklist } from './core/generator.js';
import { questions, topics, makeQuiz } from './core/quiz.js';
import { startSession, finishSession, remainingMs, formatTime } from './core/session.js';
import { validateState } from './core/storage.js';

const KEY = 'forma.v1';
const initial = () => ({ version: 1, view: 'home', config: { domain: 'retail', seed: 'FORMA-01', size: 60, difficulty: 'basic' }, delimiter: ';', quiz: null, quizHistory: [], session: null, history: [], exports: 0 });
let state = initial();
let storageWarning = '';
try {
  const stored = JSON.parse(localStorage.getItem(KEY));
  if (stored) {
    validateState(stored);
    state = { ...initial(), ...stored };
  }
} catch { storageWarning = 'Сохранение повреждено или недоступно. Открыт чистый экран. Старое сохранение будет заменено после первого действия; для восстановления сначала сохрани копию профиля приложения.'; }

const icons = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8Z"/><path d="m2 12 10 5 10-5M2 16l10 5 10-5"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
  quiz: '<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chart: '<path d="M4 4v16h16M8 16v-4m4 4V7m4 9v-6"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  shuffle: '<path d="m17 3 4 4-4 4m0 2 4 4-4 4M3 7h4l10 10h4M3 17h4l3-3m4-4 3-3h4"/>',
  book: '<path d="M12 5c-3-3-8-2-10-1v15c3-1 7-2 10 1 3-3 7-2 10-1V4c-2-1-7-2-10 1Zm0 0v15"/>',
  bag: '<path d="M4 7h16l1 14H3ZM8 8V6a4 4 0 0 1 8 0v2"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  file: '<path d="M14 2H5v20h14V7ZM14 2v6h5M8 12h8m-8 4h8"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 0 1 6 1c0 2-3 2-3 5m0 3h.01"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  medal: '<circle cx="12" cy="9" r="6"/><path d="m8 14-2 8 6-3 6 3-2-8"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] ?? icons.file}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const active = () => state.session?.status === 'running';
const label = { home: 'Обзор', quiz: 'Блиц-викторина', generator: 'Генератор данных', practice: 'На время', history: 'Мой прогресс' };
const button = (action, text, kind = '', extra = '') => `<button class="button ${kind}" data-action="${action}" ${extra}>${text}</button>`;
const dateLabel = ms => new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(ms);
const freshSeed = () => `F-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase()}`;

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { toast('Не удалось сохранить прогресс: хранилище недоступно или заполнено.', true); }
}
let toastTimer;
function toast(message, error = false) {
  const el = document.querySelector('#toast');
  el.textContent = message;
  el.className = `toast visible ${error ? 'error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 6000);
}

function stats() {
  const answered = state.quizHistory.reduce((n, q) => n + q.total, 0);
  const correct = state.quizHistory.reduce((n, q) => n + q.correct, 0);
  return { answered, correct, accuracy: answered ? Math.round(correct / answered * 100) : null, minutes: state.history.reduce((n, s) => n + Math.round((s.finishedAt - s.startedAt) / 60000), 0) };
}

function folder(domain, compact = false) {
  return `<div class="folder-art ${domain.color} ${compact ? 'compact' : ''}" aria-hidden="true"><div class="folder-back"></div><div class="folder-paper"><span>CSV</span><i></i><i></i><i></i></div><div class="folder-front">${icon(domain.icon)}<span>forma / datasets</span></div></div>`;
}

function shell(content) {
  const nav = [['home', 'home'], ['quiz', 'quiz'], ['generator', 'database'], ['practice', 'clock'], ['history', 'chart']];
  return `<div class="layout"><aside class="rail"><a class="brand-mark" href="#home" aria-label="Forma, главная">f<span>°</span></a><div class="rail-nav">${nav.map(([id, glyph]) => `<button class="rail-button ${state.view === id ? 'active' : ''}" data-view="${id}" aria-label="${label[id]}" title="${label[id]}">${icon(glyph)}</button>`).join('')}</div><div class="rail-bottom"><span class="connection-dot" title="Локальная работа"></span><div class="avatar">Я</div></div></aside>
  <aside class="sidebar"><div class="wordmark">forma<span>study workspace</span></div><div class="workspace"><div class="workspace-icon">${icon('layers')}</div><div>Демоэкзамен<small>Личное пространство</small></div><span class="version">01</span></div><div class="nav-label">ПОДГОТОВКА</div><nav>${nav.map(([id, glyph]) => `<button class="nav-item ${state.view === id ? 'selected' : ''}" data-view="${id}" ${state.view === id ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${label[id]}</span>${id === 'quiz' ? `<span class="nav-count">${questions.length}</span>` : id === 'practice' && active() ? '<span class="live-dot"></span>' : ''}</button>`).join('')}</nav><div class="sidebar-divider"></div><div class="nav-label">ПРОГРАММА</div><div class="module-row"><span class="module-index">01</span><div>Данные и нормализация<small>Текущий модуль</small></div><span class="live-dot"></span></div><div class="module-row muted"><span class="module-index">02</span><div>Базы данных<small>В планах</small></div>${icon('lock')}</div><div class="module-row muted"><span class="module-index">03</span><div>C# и WinForms<small>В планах</small></div>${icon('lock')}</div><div class="module-row muted"><span class="module-index">04</span><div>Полный экзамен<small>В планах</small></div>${icon('lock')}</div><div class="sidebar-note">${icon('globe')}<strong>Твой темп. Твоя практика.</strong><p>Данные и прогресс остаются на этом устройстве.</p><span>Без аккаунта · Без сети</span></div><div class="sidebar-footer">МОДУЛЬ 01 <span>v0.1</span></div></aside>
  <div class="main-shell"><header class="topbar"><div class="breadcrumbs">Подготовка ${icon('chevron')} <span>${label[state.view] ?? 'Обзор'}</span></div><div class="topbar-right">${active() ? `<button class="timer-pill" data-view="practice">${icon('clock')}<span data-clock>${formatTime(remainingMs(state.session))}</span></button>` : '<span class="local-pill"><span class="connection-dot"></span> Локальный режим</span>'}<span class="topbar-module">Модуль 01</span></div></header><main id="main" tabindex="-1">${storageWarning ? `<div class="notice">${esc(storageWarning)}</div>` : ''}${content}</main><footer class="main-footer"><span>Учимся понимать данные, а не запоминать ответы.</span><span>FORMA / LEARNING LAB</span></footer></div></div><dialog id="confirm-dialog"><div class="dialog-icon">${icon('clock')}</div><h2>Завершить попытку?</h2><p>Ответы будут зафиксированы, откроется разбор. Продолжить эту попытку будет нельзя.</p><div class="actions">${button('cancel-finish', 'Продолжить работу', 'secondary')}${button('confirm-finish', 'Завершить', 'primary')}</div></dialog>`;
}

function heading(eyebrow, title, description, action = '') {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
}

function home() {
  const s = stats();
  return `${heading('ТВОЁ УЧЕБНОЕ ПРОСТРАНСТВО', 'От данных — к пониманию.', 'Новая предметная область. Та же уверенность в своих навыках.', `<span class="date-chip">${new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long' }).format(new Date())}</span>`)}
  <div class="stats-row"><div><span class="stat-number">${String(state.quizHistory.length).padStart(2, '0')}</span><span class="stat-caption">Блицев пройдено</span><span class="stat-tag">Теория</span></div><div><span class="stat-number">${s.accuracy == null ? '—' : s.accuracy + '%'}</span><span class="stat-caption">Верных ответов</span></div><div><span class="stat-number">${String(state.history.length).padStart(2, '0')}</span><span class="stat-caption">Практических попыток</span></div><div><span class="stat-number">${s.minutes}<small> мин</small></span><span class="stat-caption">В практике</span></div></div>
  <div class="feature-grid"><section class="hero-card"><div class="hero-copy"><span class="pill">МОДУЛЬ 01 / ОСНОВЫ</span><h2>Сначала понять.<br>Потом нормализовать.</h2><p>Ключи, связи и формулы — через короткие вопросы с объяснениями.</p><button class="button light" data-view="quiz">Начать блиц ${icon('arrow')}</button></div><div class="orbital" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="data-orb">${icon('database')}</div><span class="orbit-label label-pk">PK</span><span class="orbit-label label-fk">FK</span><span class="orbit-label label-nf">3NF</span></div><div class="hero-bottom"><span>${questions.length} вопроса в библиотеке</span><span>~ 5 минут</span></div></section><section class="sprint-card"><div class="sprint-top">${icon('clock')}<span>ПРАКТИКА</span></div><h2>Твой первый<br>пробный экзамен.</h2><p>Новый CSV, самостоятельная работа и время на твоей стороне.</p><div class="sprint-digits">45<span>:00</span></div><button class="button secondary" data-view="practice">${active() ? 'Вернуться к попытке' : 'Настроить тренировку'} ${icon('arrow')}</button><small>Время выбираешь сам · не официальный лимит</small></section></div>
  <div class="section-heading"><div><h2>Данные для практики</h2><p>Три области. Три разные модели отношений.</p></div><button class="text-button" data-view="generator">Открыть генератор ${icon('arrow')}</button></div><div class="domain-grid">${domains.map(d => `<button class="domain-card" data-action="domain" data-domain="${d.id}">${folder(d)}<div class="domain-info"><div><h3>${d.name}</h3><p>${d.subtitle}</p></div>${icon('arrow')}</div></button>`).join('')}</div>
  <div class="section-heading"><div><h2>Последние попытки</h2><p>Возвращайся к результатам и находи, что повторить.</p></div><button class="text-button" data-view="history">Весь прогресс ${icon('arrow')}</button></div>${historyTable(3)}`;
}

function configFields(config, { duration = false } = {}) {
  return `<label>Предметная область<select name="domain">${domains.map(d => `<option value="${d.id}" ${config.domain === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}</select></label><div class="field-row"><label>Строк в источнике<input name="size" type="number" min="20" max="500" value="${config.size}" required></label><label>Сложность<select name="difficulty"><option value="basic" ${config.difficulty === 'basic' ? 'selected' : ''}>Базовая</option><option value="advanced" ${config.difficulty === 'advanced' ? 'selected' : ''}>С очисткой данных</option></select></label></div><label>Код варианта<div class="seed-field"><input name="seed" value="${esc(config.seed)}" maxlength="40" pattern="(?:[A-Za-z0-9_]|-)+" required><button type="button" data-action="random-seed" aria-label="Новый случайный код" title="Новый случайный код">${icon('shuffle')}</button></div></label>${duration ? '<label>Лимит времени, минут<input name="minutes" type="number" min="1" max="240" value="45" required></label>' : `<label>Разделитель CSV<select name="delimiter"><option value=";" ${state.delimiter === ';' ? 'selected' : ''}>Точка с запятой ;</option><option value="," ${state.delimiter === ',' ? 'selected' : ''}>Запятая ,</option></select></label>`}`;
}

function exportButtons() {
  return window.desktop ? button('export', `${icon('download')} Сохранить набор`, 'primary') : `<div class="actions">${button('download', `${icon('download')} CSV`, 'primary', 'data-file="source.csv"')}${button('download', 'Задание', 'secondary', 'data-file="assignment.md"')}${button('download', 'Параметры', 'ghost', 'data-file="variant.json"')}</div>`;
}

function datasetInfo(dataset) {
  return `<div class="dataset-title"><span class="file-icon">${icon('file')}</span><div><h3>source.csv</h3><span>${dataset.rows.length} строк · ${dataset.headers.length} полей · UTF-8</span></div><span class="pill subtle">${esc(dataset.config.seed)}</span></div><div class="table-scroll"><table class="data-table"><thead><tr>${dataset.headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${dataset.rows.slice(0, 6).map(row => `<tr>${dataset.headers.map(h => `<td>${esc(row[h])}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="table-foot">Первые 6 строк · Полный набор доступен в CSV<span>v${dataset.version}</span></div>`;
}

function tasksList(dataset) {
  return dataset.tasks.map((task, i) => `<div class="task-line"><span>${String(i + 1).padStart(2, '0')}</span><p>${esc(task.prompt)}</p></div>`).join('');
}

function generator() {
  const data = generateDataset(state.config);
  return `${heading('СОЗДАЙ СВОЙ ВАРИАНТ', 'Лаборатория данных', 'Исходники и условия меняются. Решение всегда остаётся за тобой.')}
  ${active() ? '<div class="notice">Идёт попытка на время. Генерация других вариантов доступна после завершения.</div>' : ''}
  <div class="generator-layout"><section class="panel config-panel"><div class="panel-title">${icon('shuffle')}<h2>Параметры варианта</h2></div><form id="generator-form">${configFields(state.config)}<button type="submit" class="button primary full" ${active() ? 'disabled' : ''}>Сгенерировать ${icon('arrow')}</button></form><div class="small-note">Одинаковые параметры дают одинаковые данные. Все записи вымышлены. Уровень с очисткой добавляет крайние пробелы.</div></section><div class="generator-right"><section class="panel dataset-panel"><div class="dataset-summary">${folder(data.domain, true)}<div><span class="eyebrow">УЧЕБНЫЙ НАБОР</span><h2>${data.domain.name}</h2><p>${data.domain.grain}</p></div></div>${datasetInfo(data)}<div class="export-row"><span>CSV + задание + параметры<br><small>Без готовой схемы и ответов</small></span>${exportButtons()}</div></section><section class="panel"><div class="panel-title"><h2>Условия выборок</h2><span class="pill subtle">3 задания</span></div>${tasksList(data)}<p class="small-note">После нормализации выполни выборки в Calc или SQL. В тренировке проверяются числовые ответы, не текст запросов.</p></section></div></div>
  <section class="panel rules-panel"><div><span class="eyebrow">СНАЧАЛА ПРОЧИТАЙ</span><h2>Правила предметной области</h2><p>${data.domain.description}</p></div><ul>${data.rules.map(rule => `<li>${esc(rule)}</li>`).join('')}</ul></section>`;
}

function quizView() {
  const quiz = state.quiz;
  if (!quiz) return `${heading('КОРОТКО. ОСМЫСЛЕННО.', 'Проверим понимание?', 'Не вспоминай готовый код. Выбирай ответ и разбирай причину.')}<div class="quiz-intro panel"><div class="quiz-illustration">${icon('quiz')}</div><span class="pill">БЛИЦ / МОДУЛЬ 01</span><h2>Один вопрос — одна идея.</h2><p>До 8 вопросов за подход. Порядок вопросов и ответов меняется.<br>Подсказки доступны, но самостоятельные ответы отмечаются отдельно.</p><form id="quiz-form"><label>Тема<select name="topic"><option>Все темы</option>${topics.map(t => `<option>${t}</option>`).join('')}</select></label><button class="button primary" type="submit">Начать викторину ${icon('arrow')}</button></form><div class="intro-tags"><span>${questions.length} вопроса</span><span>Разбор каждого ответа</span><span>Без таймера</span></div></div>`;
  if (quiz.completed) {
    const correct = quiz.answers.filter(a => a.correct).length;
    const independent = quiz.answers.filter(a => a.correct && !a.hint).length;
    return `${heading('ЕЩЁ ОДИН ШАГ ВПЕРЁД', 'Блиц завершён', 'Правильный ответ важен. Понимание причины — ещё важнее.')}<section class="panel result-hero"><div class="result-score">${correct}<span> / ${quiz.questions.length}</span></div><h2>${correct === quiz.questions.length ? 'Отличный результат.' : 'Есть что закрепить.'}</h2><p>Самостоятельно верных: ${independent}. С подсказкой: ${quiz.answers.filter(a => a.hint).length}.</p><div class="actions">${button('new-quiz', 'Новый блиц', 'primary')}${button('view-generator', 'Перейти к практике', 'secondary')}</div></section><div class="section-heading"><h2>Разбор вопросов</h2></div><div class="review-list">${quiz.questions.map((q, i) => `<article class="panel review-item">${icon(quiz.answers[i].correct ? 'check' : 'close', quiz.answers[i].correct ? 'green-text' : 'orange-text')}<div><h3>${esc(q.question)}</h3><p>Твой ответ: ${esc(q.options[quiz.answers[i].choice])}</p><p class="bright">${esc(q.explanation)}</p></div></article>`).join('')}</div>`;
  }
  const index = quiz.answers.length;
  const q = quiz.questions[index];
  const pending = quiz.pending;
  return `${heading('ТРЕНИРУЕМ ПОНИМАНИЕ', 'Блиц-викторина', 'Думай о смысле данных. Не торопись.')}<section class="panel quiz-card"><div class="quiz-meta"><span class="pill subtle">${q.topic}</span><span>Вопрос ${index + 1} <span class="muted">/ ${quiz.questions.length}</span></span></div><progress max="${quiz.questions.length}" value="${index}"></progress><h2>${esc(q.question)}</h2><div class="answer-options">${q.options.map((option, i) => `<button class="answer ${pending ? i === q.correct ? 'correct' : pending.choice === i ? 'incorrect' : '' : ''}" data-action="answer" data-choice="${i}" ${pending ? 'disabled' : ''}><span class="answer-letter">${String.fromCharCode(65 + i)}</span><span>${esc(option)}</span>${pending && i === q.correct ? icon('check') : ''}</button>`).join('')}</div>${pending ? `<div class="feedback ${pending.correct ? 'success' : 'try-again'}"><strong>${pending.correct ? 'Верно. Вот почему:' : 'Разберём, почему иначе:'}</strong><p>${esc(q.explanation)}</p></div>` : quiz.hint ? `<div class="hint-box">${icon('help')}<p>${esc(q.hint)}</p></div>` : ''}<div class="quiz-footer">${!pending ? button('hint', `${icon('help')} Подсказка`, 'ghost', quiz.hint ? 'disabled' : '') : '<span class="small-note">Знание закрепляется через объяснение.</span>'}${pending ? button('next-question', `${index + 1 === quiz.questions.length ? 'Завершить блиц' : 'Следующий вопрос'} ${icon('arrow')}`, 'primary') : '<span class="small-note">Выбери один ответ</span>'}</div></section>`;
}

function practice() {
  const session = state.session;
  if (!session) return `${heading('САМОСТОЯТЕЛЬНЫЙ РЕЖИМ', 'Практика на время', 'Тренируй первую часть: от исходной таблицы до связанной модели.')}<div class="practice-setup"><section class="panel"><div class="panel-title">${icon('clock')}<h2>Новая попытка</h2></div><form id="practice-form">${configFields(state.config, { duration: true })}<button class="button primary full" type="submit">Запустить таймер ${icon('arrow')}</button></form></section><section class="practice-guide"><span class="pill">КАК ЭТО РАБОТАЕТ</span><h2>Твоя работа.<br>Твои решения.</h2><ol><li><strong>Забери исходники</strong><p>Сохрани CSV и условия, открой данные в LibreOffice Calc.</p></li><li><strong>Нормализуй самостоятельно</strong><p>Определи сущности, PK и FK. Сохрани .ods и отдельные CSV.</p></li><li><strong>Выполни выборки</strong><p>Введи три числовых ответа и пройди чек-лист.</p></li><li><strong>Разбери результат</strong><p>Ответы откроются после завершения. Схему оцениваешь самостоятельно.</p></li></ol><div class="notice">Таймер продолжает идти при закрытии приложения и во время сна. Паузы нет. Это учебный лимит, не официальный регламент.</div></section></div>`;
  const data = generateDataset(session.config);
  if (session.status !== 'running') return report(session, data);
  return `${heading('ПОПЫТКА В ПРОЦЕССЕ', data.domain.name, `Вариант ${esc(session.config.seed)} · ${session.config.size} строк · работа в Calc`, `<div class="big-timer">${icon('clock')}<span data-clock>${formatTime(remainingMs(session))}</span></div>`)}<progress class="session-progress" max="${session.minutes * 60000}" value="${remainingMs(session)}" data-time-progress></progress><div class="practice-active"><div><section class="panel"><div class="panel-title"><h2>01. Исходники и условия</h2>${exportButtons()}</div><p>${data.domain.description} ${data.domain.grain}</p><ul class="rules-list">${data.rules.map(rule => `<li>${esc(rule)}</li>`).join('')}</ul><div class="small-note">${session.exported ? 'Набор сохранён. Работай в отдельной книге, не меняй исходный CSV.' : 'Сначала сохрани набор. В нём нет готового решения.'}</div></section><section class="panel"><h2>02. Результаты выборок</h2><p class="muted">Ответы проверятся только после завершения.</p><div class="task-inputs">${data.tasks.map((task, i) => `<label class="task-input"><span><b>${i + 1}.</b> ${esc(task.prompt)}</span><input type="text" inputmode="numeric" pattern="[0-9]+" data-answer="${task.id}" value="${esc(session.answers[task.id] ?? '')}" placeholder="Целое число" aria-label="Ответ на задание ${i + 1}"></label>`).join('')}</div></section></div><aside class="panel checklist-panel"><span class="eyebrow">САМОПРОВЕРКА</span><h2>03. Нормализация</h2><p>Отметь только то, что действительно сделал.</p>${checklist.map((text, i) => `<label class="check-item"><input type="checkbox" data-check="${i}" ${session.checks.includes(i) ? 'checked' : ''}><span>${text}</span></label>`).join('')}<div class="notice">Это твоя самооценка. Приложение не проверяет структуру созданных таблиц.</div>${button('finish', 'Завершить попытку', 'primary full')}<small>Можно завершить раньше таймера.</small></aside></div>`;
}

function report(session, data) {
  const grades = gradeTasks(data, session.answers);
  const score = grades.filter(g => g.correct).length;
  const status = { submitted: 'Попытка завершена', expired: 'Время вышло', interrupted: 'Попытка прервана' }[session.status];
  return `${heading('РАЗБОР ПРАКТИКИ', status, `${data.domain.name} · ${esc(session.config.seed)} · ${dateLabel(session.startedAt)}`, button('new-session', 'Новая попытка', 'primary'))}<div class="report-stats"><div class="panel"><span class="eyebrow">ВЫБОРКИ</span><strong>${score}<small> / 3</small></strong><p>Верных числовых ответов</p></div><div class="panel"><span class="eyebrow">ВРЕМЯ</span><strong>${formatTime(session.finishedAt - session.startedAt)}</strong><p>Из ${session.minutes} минут</p></div><div class="panel"><span class="eyebrow">САМОПРОВЕРКА</span><strong>${session.checks.length}<small> / 4</small></strong><p>Отмечено тобой, не проверено автоматически</p></div></div><div class="review-list">${grades.map((g, i) => `<section class="panel review-item">${icon(g.correct ? 'check' : 'close', g.correct ? 'green-text' : 'orange-text')}<div><span class="eyebrow">ЗАДАНИЕ ${i + 1}</span><h3>${esc(g.prompt)}</h3><div class="answer-comparison"><span>Твой ответ <b>${esc(g.submitted || 'Не указан')}</b></span><span>Верный ответ <b>${g.answer}</b></span></div><p>${g.explanation}</p></div></section>`).join('')}</div><section class="panel reflection"><h2>Объясни своё решение</h2>${data.questions.map(q => `<p>${esc(q)}</p>`).join('')}<div class="notice">Результат выборок не доказывает правильность нормализации. Открой свою .ods, проверь PK/FK и объясни зависимости. Официальные экзаменационные баллы не рассчитываются.</div></section>`;
}

function historyTable(limit = 100) {
  const rows = [...state.history.map(s => ({ kind: 'practice', id: s.id, time: s.finishedAt, name: domains.find(d => d.id === s.config.domain)?.name ?? '', sub: s.config.seed, result: `${gradeTasks(generateDataset(s.config), s.answers).filter(g => g.correct).length} / 3`, badge: s.status === 'expired' ? 'Время вышло' : 'Завершено' })), ...state.quizHistory.map(q => ({ kind: 'quiz', time: q.time, name: 'Блиц-викторина', sub: q.topic, result: `${q.correct} / ${q.total}`, badge: 'Пройдено' }))].sort((a, b) => b.time - a.time).slice(0, limit);
  return `<div class="panel history-panel">${!rows.length ? `<div class="empty-state">${icon('chart')}<h3>Здесь начнётся твоя история</h3><p>Пройди первый блиц или закончи практическую попытку.</p></div>` : `<div class="table-scroll"><table class="history-table"><thead><tr><th>ПОПЫТКА</th><th>ДАТА</th><th>РЕЗУЛЬТАТ</th><th>СТАТУС</th></tr></thead><tbody>${rows.map(row => `<tr><td><div class="history-name">${icon(row.kind === 'quiz' ? 'quiz' : 'database')}<div>${row.kind === 'practice' ? `<button class="text-button" data-action="open-report" data-id="${esc(row.id)}">${esc(row.name)}</button>` : esc(row.name)}<small>${esc(row.sub)}</small></div></div></td><td>${dateLabel(row.time)}</td><td><b>${row.result}</b></td><td><span class="pill subtle">${row.badge}</span></td></tr>`).join('')}</tbody></table></div>`}</div>`;
}

function history() {
  const s = stats();
  const badges = [
    ['Первый шаг', 'Завершить первый блиц', state.quizHistory.length > 0],
    ['Без подсказок', 'Весь блиц верно и самостоятельно', state.quizHistory.some(q => q.correct === q.total && q.hints === 0)],
    ['Точный результат', 'Все три выборки верны', state.history.some(s => gradeTasks(generateDataset(s.config), s.answers).every(g => g.correct))],
    ['Новый контекст', 'Завершить практику в трёх областях', new Set(state.history.map(s => s.config.domain)).size === 3]
  ];
  return `${heading('НЕ ТОЛЬКО ЦИФРЫ', 'Твой прогресс', 'Отмечаем практику и самостоятельность. Не выдаём активность за освоение.')}
  <div class="achievement-grid">${badges.map(([name, description, earned]) => `<article class="panel achievement ${earned ? 'earned' : ''}"><div class="badge-art">${icon(earned ? 'medal' : 'lock')}</div><span class="eyebrow">${earned ? 'ОТКРЫТО' : 'ВПЕРЕДИ'}</span><h3>${name}</h3><p>${description}</p></article>`).join('')}</div><div class="section-heading"><div><h2>История занятий</h2><p>${s.answered} ответов в завершённых блицах · ${state.exports} сохранений учебных файлов</p></div></div>${historyTable()}<div class="notice">Прогресс хранится локально в этом приложении. В браузерном предпросмотре — отдельно, в текущем браузере. Чек-лист нормализации — самооценка, не автоматический зачёт.</div>`;
}

function render() {
  if (!label[state.view]) state.view = 'home';
  document.querySelector('#app').innerHTML = shell(({ home, generator, quiz: quizView, practice, history })[state.view]());
}

function complete() {
  if (!active()) return;
  state.session = finishSession(state.session);
  if (!state.history.some(s => s.id === state.session.id)) state.history.push(structuredClone(state.session));
  state.view = 'practice';
  save(); render();
}

async function exportCurrent(fileName) {
  const config = active() && state.view === 'practice' ? state.session.config : state.config;
  if (window.desktop) {
    const result = await window.desktop.exportDataset(config, state.delimiter);
    if (result.canceled) return;
    toast(`Набор сохранён: ${result.directory}`);
  } else {
    const file = exportFiles(config, state.delimiter).find(f => f.name === fileName);
    if (!file) throw new Error('Файл не найден.');
    const url = URL.createObjectURL(new Blob([file.content], { type: file.name.endsWith('.csv') ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `${config.domain}-${config.seed}-${file.name}`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Файл передан браузеру для скачивания.');
  }
  state.exports++;
  if (active() && state.view === 'practice') state.session.exported = true;
  save(); render();
}

document.addEventListener('click', async event => {
  const target = event.target.closest('[data-view], [data-action]');
  if (!target || target.disabled) return;
  try {
    if (active() && Date.now() >= state.session.deadline) { complete(); return; }
    if (target.dataset.view) {
      if (active() && target.dataset.view === 'quiz') { toast('Блиц и подсказки доступны после завершения попытки.'); return; }
      state.view = target.dataset.view; save(); render(); return;
    }
    switch (target.dataset.action) {
      case 'domain':
        if (active()) { state.view = 'practice'; break; }
        state.config.domain = target.dataset.domain; state.view = 'generator'; break;
      case 'random-seed': target.closest('form').elements.seed.value = freshSeed(); return;
      case 'export': case 'download':
        target.disabled = true;
        try { await exportCurrent(target.dataset.file); } finally { target.disabled = false; }
        return;
      case 'answer': {
        const quiz = state.quiz;
        if (!quiz || quiz.completed || quiz.pending) return;
        const q = quiz.questions[quiz.answers.length];
        quiz.pending = { choice: Number(target.dataset.choice), correct: Number(target.dataset.choice) === q.correct, hint: !!quiz.hint }; break;
      }
      case 'hint': state.quiz.hint = true; break;
      case 'next-question': {
        const quiz = state.quiz;
        if (!quiz?.pending || quiz.completed) return;
        quiz.answers.push(quiz.pending); quiz.pending = null; quiz.hint = false;
        if (quiz.answers.length === quiz.questions.length) {
          quiz.completed = true;
          state.quizHistory.push({ time: Date.now(), topic: quiz.topic, correct: quiz.answers.filter(a => a.correct).length, total: quiz.questions.length, hints: quiz.answers.filter(a => a.hint).length });
        }
        break;
      }
      case 'new-quiz': state.quiz = null; break;
      case 'view-generator': state.view = 'generator'; break;
      case 'finish': document.querySelector('#confirm-dialog').showModal(); return;
      case 'cancel-finish': document.querySelector('#confirm-dialog').close(); return;
      case 'confirm-finish': complete(); return;
      case 'new-session': state.session = null; state.config.seed = freshSeed(); break;
      case 'open-report':
        if (active()) { toast('Сначала заверши текущую попытку.'); return; }
        state.session = structuredClone(state.history.find(s => s.id === target.dataset.id)); state.view = 'practice'; break;
      default: return;
    }
    save(); render();
  } catch (error) { toast(error.message || 'Что-то пошло не так.', true); }
});

document.addEventListener('submit', event => {
  event.preventDefault();
  try {
    const form = event.target;
    if (active()) { toast('Сначала заверши текущую попытку.'); return; }
    const values = Object.fromEntries(new FormData(form));
    if (form.id === 'generator-form') {
      state.config = normalizeConfig(values); state.delimiter = values.delimiter;
      save(); render(); toast('Новый вариант готов. Сохрани исходники и задание.');
    }
    if (form.id === 'quiz-form') {
      state.quiz = { questions: makeQuiz(freshSeed(), values.topic), topic: values.topic, answers: [], pending: null, hint: false, completed: false };
      save(); render();
    }
    if (form.id === 'practice-form') {
      const config = normalizeConfig(values);
      state.session = startSession(config, Number(values.minutes)); state.config = config;
      save(); render();
    }
  } catch (error) { toast(error.message, true); }
});

document.addEventListener('input', event => {
  if (!active()) return;
  if (Date.now() >= state.session.deadline) { complete(); return; }
  if (event.target.dataset.answer) { state.session.answers[event.target.dataset.answer] = event.target.value.slice(0, 20); save(); }
  if (event.target.dataset.check !== undefined) {
    const value = Number(event.target.dataset.check);
    state.session.checks = event.target.checked ? [...new Set([...state.session.checks, value])] : state.session.checks.filter(i => i !== value);
    save();
  }
});
window.addEventListener('hashchange', () => { if (location.hash === '#home') { state.view = 'home'; save(); render(); } });
setInterval(() => {
  if (!active()) return;
  const remaining = remainingMs(state.session);
  if (!remaining) { complete(); return; }
  document.querySelectorAll('[data-clock]').forEach(el => { el.textContent = formatTime(remaining); });
  document.querySelectorAll('[data-time-progress]').forEach(el => { el.value = remaining; });
}, 250);
if (active() && !remainingMs(state.session)) complete(); else render();
