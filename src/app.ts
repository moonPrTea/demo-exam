import {query, errorMessage, html} from './dom.js';
import type {
  AppState,
  Config,
  Dataset,
  Domain,
  PracticeSession,
  View,
} from './core/types.js';
import {enhanceNumbers} from './numbers.js';
import {newVariant} from './core/variants.js';
import {enhanceSelects, closeSelectMenu} from './selects.js';
import {
  domains,
  generateDataset,
  normalizeConfig,
  exportFiles,
  gradeTasks,
  checklist,
} from './core/generator.js';
import {questions, topics, makeQuiz} from './core/quiz.js';
import {
  startSession,
  finishSession,
  remainingMs,
  formatTime,
} from './core/session.js';
import {validateState} from './core/storage.js';

const KEY = 'forma.v1';
const initial = (): AppState => ({
  version: 1,
  view: 'home',
  config: {domain: 'retail', seed: 'FORMA-01', size: 60, difficulty: 'basic'},
  delimiter: ';',
  quiz: null,
  quizHistory: [],
  session: null,
  history: [],
  exports: 0,
});
let state = initial();
let storageWarning = '';
try {
  const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null') as unknown;
  if (stored) {
    state = {...initial(), ...validateState(stored)};
  }
} catch {
  storageWarning =
    'Сохранение повреждено или недоступно. Открыт чистый экран. Старое сохранение будет заменено после первого действия; для восстановления сначала сохрани копию профиля приложения.';
}

const icons: Record<string, string> = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  layers:
    '<path d="m12 3 10 5-10 5L2 8Z"/><path d="m2 12 10 5 10-5M2 16l10 5 10-5"/>',
  database:
    '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
  quiz: '<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chart: '<path d="M4 4v16h16M8 16v-4m4 4V7m4 9v-6"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  shuffle:
    '<path d="M19 8a7 7 0 0 0-12-2L4 9m0-5v5h5M5 16a7 7 0 0 0 12 2l3-3m0 5v-5h-5"/>',
  book: '<path d="M12 5c-3-3-8-2-10-1v15c3-1 7-2 10 1 3-3 7-2 10-1V4c-2-1-7-2-10 1Zm0 0v15"/>',
  bag: '<path d="M4 7h16l1 14H3ZM8 8V6a4 4 0 0 1 8 0v2"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  file: '<path d="M14 2H5v20h14V7ZM14 2v6h5M8 12h8m-8 4h8"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 0 1 6 1c0 2-3 2-3 5m0 3h.01"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  medal: '<circle cx="12" cy="9" r="6"/><path d="m8 14-2 8 6-3 6 3-2-8"/>',
};
const icon = (name: string, cls = '') =>
  html`<svg
    class="icon ${cls}"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    ${icons[name] ?? icons.file}
  </svg>`;
const esc = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    char =>
      ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[
        char
      ] ?? char,
  );
const caption = (text: string) => String(text).replace(/\.\s*$/, '');
const active = () => state.session?.status === 'running';
const label: Record<View, string> = {
  home: 'Обзор',
  quiz: 'Блиц-викторина',
  generator: 'Генератор данных',
  practice: 'На время',
  history: 'Мой прогресс',
};
const button = (action: string, text: string, kind = '', extra = '') =>
  html`<button class="button ${kind}" data-action="${action}" ${extra}>
    ${text}
  </button>`;
const dateLabel = (ms: number) =>
  new Intl.DateTimeFormat('ru', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ms);
const freshSeed = () =>
  `F-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase()}`;

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    toast(
      'Не удалось сохранить прогресс: хранилище недоступно или заполнено.',
      true,
    );
  }
}
let toastTimer: ReturnType<typeof setTimeout>;
function toast(message: string, error = false) {
  const el = query('#toast');
  el.textContent = message;
  el.className = `toast visible ${error ? 'error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 6000);
}

function stats() {
  const answered = state.quizHistory.reduce((n, q) => n + q.total, 0);
  const correct = state.quizHistory.reduce((n, q) => n + q.correct, 0);
  return {
    answered,
    correct,
    accuracy: answered ? Math.round((correct / answered) * 100) : null,
    minutes: state.history.reduce(
      (n, s) => n + Math.round((s.finishedAt! - s.startedAt) / 60000),
      0,
    ),
  };
}

function folder(domain: Domain) {
  return html`<div class="domain-icon" aria-hidden="true">
    ${icon(domain.icon)}
  </div>`;
}

function shell(content: string) {
  const nav: [View, string][] = [
    ['home', 'home'],
    ['quiz', 'quiz'],
    ['generator', 'database'],
    ['practice', 'clock'],
    ['history', 'chart'],
  ];
  return html`<div class="layout">
      <aside class="rail">
        <a class="brand-mark" href="#home" aria-label="formatted, главная"
          ><img class="brand-logo" src="assets/forma.svg" alt=""
        /></a>
        <div class="rail-nav">
          ${nav.map(([id, glyph]) => html`<button class="rail-button ${state.view === id ? 'active' : ''}" data-view="${id}" aria-label="${label[id]}" title="${label[id]}">${icon(glyph)}</button>`).join('')}
        </div>
        <div class="rail-bottom">
          <span class="connection-dot" title="Локальная работа"></span>
          <div class="avatar">Я</div>
        </div>
      </aside>
      <aside class="sidebar">
        <div class="wordmark">
          <img class="brand-logo" src="assets/forma.svg" alt="" />formatted
        </div>
        <div class="workspace">
          <div class="workspace-icon">${icon('layers')}</div>
          <div>Демоэкзамен<small>Личное пространство</small></div>
          <span class="version">01</span>
        </div>
        <div class="nav-label">ПОДГОТОВКА</div>
        <nav>
          ${nav.map(([id, glyph]) => html`<button class="nav-item ${state.view === id ? 'selected' : ''}" data-view="${id}" ${state.view === id ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${label[id]}</span>${id === 'quiz' ? html`<span class="nav-count">${questions.length}</span>` : id === 'practice' && active() ? '<span class="live-dot"></span>' : ''}</button>`).join('')}
        </nav>
        <div class="sidebar-divider"></div>
        <div class="nav-label">ПРОГРАММА</div>
        <div class="module-row">
          <span class="module-index">01</span>
          <div>Данные и нормализация<small>Текущий модуль</small></div>
          <span class="live-dot"></span>
        </div>
        <div class="module-row muted">
          <span class="module-index">02</span>
          <div>Базы данных<small>В планах</small></div>
          ${icon('lock')}
        </div>
        <div class="module-row muted">
          <span class="module-index">03</span>
          <div>C# и WinForms<small>В планах</small></div>
          ${icon('lock')}
        </div>
        <div class="module-row muted">
          <span class="module-index">04</span>
          <div>Полный экзамен<small>В планах</small></div>
          ${icon('lock')}
        </div>
        <div class="sidebar-note">
          ${icon('globe')}<strong>Твой темп. Твоя практика</strong>
          <p>Данные и прогресс остаются на этом устройстве</p>
          <span>Без аккаунта, Без сети</span>
        </div>
        <div class="sidebar-footer">МОДУЛЬ 01 <span>v0.1</span></div>
      </aside>
      <div class="main-shell">
        <header class="topbar">
          <div class="breadcrumbs">
            Подготовка ${icon('chevron')}
            <span>${label[state.view] ?? 'Обзор'}</span>
          </div>
          <div class="topbar-right">
            ${active() ? html`<button class="timer-pill" data-view="practice">${icon('clock')}<span data-clock>${formatTime(remainingMs(state.session))}</span></button>` : '<span class="local-pill"><span class="connection-dot"></span> Локальный режим</span>'}<span
              class="topbar-module"
              >Модуль 01</span
            >
          </div>
        </header>
        <main id="main" tabindex="-1">
          ${storageWarning ? html`<div class="notice">${esc(storageWarning)}</div>` : ''}${content}
        </main>
        <footer class="main-footer">
          <span>Учимся понимать данные, а не запоминать ответы</span
          ><span>FORMATTED / LEARNING LAB</span>
        </footer>
      </div>
    </div>
    <dialog id="confirm-dialog">
      <div class="dialog-icon">${icon('clock')}</div>
      <h2>Завершить попытку?</h2>
      <p>
        Ответы будут зафиксированы, откроется разбор. Продолжить эту попытку
        будет нельзя
      </p>
      <div class="actions">
        ${button('cancel-finish', 'Продолжить работу', 'secondary')}${button('confirm-finish', 'Завершить', 'primary')}
      </div>
    </dialog>`;
}

function heading(
  eyebrow: string,
  title: string,
  description: string,
  action = '',
) {
  return html`<div class="page-heading">
    <div>
      <div class="eyebrow">${eyebrow}</div>
      <h1>${caption(title)}</h1>
      <p>${caption(description)}</p>
    </div>
    ${action}
  </div>`;
}

function home() {
  const s = stats();
  return html`${heading('ТВОЁ УЧЕБНОЕ ПРОСТРАНСТВО', 'От данных - к пониманию.', 'Новая предметная область. Та же уверенность в своих навыках.', html`<span class="date-chip">${new Intl.DateTimeFormat('ru', {day: 'numeric', month: 'long'}).format(new Date())}</span>`)}
    <div class="stats-row">
      <div>
        <span class="stat-number"
          >${String(state.quizHistory.length).padStart(2, '0')}</span
        ><span class="stat-caption">Блицев пройдено</span
        ><span class="stat-tag">Теория</span>
      </div>
      <div>
        <span class="stat-number"
          >${s.accuracy === null ? '-' : s.accuracy + '%'}</span
        ><span class="stat-caption">Верных ответов</span>
      </div>
      <div>
        <span class="stat-number"
          >${String(state.history.length).padStart(2, '0')}</span
        ><span class="stat-caption">Практических попыток</span>
      </div>
      <div>
        <span class="stat-number">${s.minutes}<small> мин</small></span
        ><span class="stat-caption">В практике</span>
      </div>
    </div>
    <div class="feature-grid">
      <section class="hero-card">
        <div class="hero-copy">
          <span class="pill">МОДУЛЬ 01 / ОСНОВЫ</span>
          <h2>Сначала понять<br />Потом нормализовать</h2>
          <p>Ключи, связи и формулы - через короткие вопросы с объяснениями</p>
          <button class="button light" data-view="quiz">
            Начать блиц ${icon('arrow')}
          </button>
        </div>
        <div class="hero-bottom">
          <span>${questions.length} вопроса в библиотеке</span
          ><span>~ 5 минут</span>
        </div>
      </section>
      <section class="sprint-card">
        <div class="sprint-top">${icon('clock')}<span>ПРАКТИКА</span></div>
        <h2>Практика на время</h2>
        <p>Новый CSV, самостоятельная работа и время на твоей стороне</p>
        <div class="sprint-digits">45<span>:00</span></div>
        <button class="button secondary" data-view="practice">
          ${active() ? 'Вернуться к попытке' : 'Настроить тренировку'}
          ${icon('arrow')}</button
        ><small>Время выбираешь сам, не официальный лимит</small>
      </section>
    </div>
    <div class="section-heading">
      <div>
        <h2>Данные для практики</h2>
        <p>Три области. Три разные модели отношений</p>
      </div>
      <button class="text-button" data-view="generator">
        Открыть генератор ${icon('arrow')}
      </button>
    </div>
    <div class="domain-grid">
      ${domains
        .map(
          d =>
            html`<button
              class="domain-card"
              data-action="domain"
              data-domain="${d.id}"
            >
              ${folder(d)}
              <div class="domain-info">
                <div>
                  <h3>${d.name}</h3>
                  <p>${caption(d.subtitle)}</p>
                </div>
                ${icon('arrow')}
              </div>
            </button>`,
        )
        .join('')}
    </div>
    <div class="section-heading">
      <div>
        <h2>Последние попытки</h2>
        <p>Возвращайся к результатам и находи, что повторить</p>
      </div>
      <button class="text-button" data-view="history">
        Весь прогресс ${icon('arrow')}
      </button>
    </div>
    ${historyTable(3)}`;
}

function configFields(config: Config, {duration = false} = {}) {
  return html`<label
      >Предметная область<select name="domain">
        ${domains.map(d => html`<option value="${d.id}" ${config.domain === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
      </select></label
    >
    <div class="field-row">
      <label
        >Количество строк<input
          name="size"
          type="number"
          min="20"
          max="500"
          value="${config.size}"
          required /></label
      ><label
        >Сложность<select name="difficulty">
          <option
            value="basic"
            ${config.difficulty === 'basic' ? 'selected' : ''}
          >
            Базовая
          </option>
          <option
            value="advanced"
            ${config.difficulty === 'advanced' ? 'selected' : ''}
          >
            С очисткой
          </option>
        </select></label
      >
    </div>
    <label
      >Код для повторного открытия
      <div class="seed-field">
        <input
          name="seed"
          value="${esc(config.seed)}"
          maxlength="40"
          pattern="(?:[A-Za-z0-9_]|-)+"
          required
        /><button
          type="button"
          data-action="random-seed"
          aria-label="Новый случайный код"
          title="Новый случайный код"
        >
          ${icon('shuffle')}
        </button>
      </div></label
    >${
      duration
        ? '<label>Лимит времени, минут<input name="minutes" type="number" min="1" max="240" value="45" required></label>'
        : html`<label
            >Разделитель CSV<select name="delimiter">
              <option value=";" ${state.delimiter === ';' ? 'selected' : ''}>
                Точка с запятой ;
              </option>
              <option value="," ${state.delimiter === ',' ? 'selected' : ''}>
                Запятая ,
              </option>
            </select></label
          >`
    }`;
}

function exportButtons() {
  return window.desktop
    ? button('export', `${icon('download')} Сохранить набор`, 'primary')
    : html`<div class="actions">
        ${button('download', `${icon('download')} CSV`, 'primary', 'data-file="source.csv"')}${button('download', 'Задание', 'secondary', 'data-file="assignment.md"')}${button('download', 'Параметры', 'ghost', 'data-file="variant.json"')}
      </div>`;
}

let csvPage = 0;
let csvVariant = '';
const csvPageSize = 10;

function datasetInfo(dataset: Dataset) {
  const key = JSON.stringify(dataset.config);
  if (key !== csvVariant) {
    csvPage = 0;
    csvVariant = key;
  }
  const pages = Math.ceil(dataset.rows.length / csvPageSize);
  csvPage = Math.max(0, Math.min(csvPage, pages - 1));
  const start = csvPage * csvPageSize;
  const rows = dataset.rows.slice(start, start + csvPageSize);
  return html`<div class="csv-preview">
    <div class="dataset-title">
      <span class="file-icon">${icon('file')}</span>
      <div>
        <h3>source.csv</h3>
        <span
          >${dataset.rows.length} строк, ${dataset.headers.length} полей,
          UTF-8</span
        >
      </div>
      <div class="dataset-summary">
        <h2>${dataset.domain.name}</h2>
        <p>${caption(dataset.domain.grain)}</p>
      </div>
      <span class="pill subtle">${esc(dataset.config.seed)}</span>
    </div>
    <div class="preview-guide">
      <span>Исходные данные, без изменений</span
      ><span>Прокрути таблицу вправо, чтобы увидеть остальные столбцы</span>
    </div>
    <div
      class="table-scroll csv-scroll"
      tabindex="0"
      role="region"
      aria-label="Исходный CSV, прокрутка по горизонтали"
    >
      <table class="data-table" aria-label="Предпросмотр исходного CSV">
        <thead>
          <tr>
            <th class="row-number" scope="col">№</th>
            ${dataset.headers.map(h => html`<th scope="col">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row, i) =>
                html`<tr>
                  <th scope="row" class="row-number">${start + i + 1}</th>
                  ${dataset.headers.map(h => html`<td><span title="${esc(row[h])}">${esc(row[h])}</span></td>`).join('')}
                </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>
    <div class="table-foot">
      <span aria-live="polite"
        >Строки ${start + 1}-${start + rows.length} из
        ${dataset.rows.length}</span
      >
      <div class="csv-pagination">
        <button
          type="button"
          class="button secondary"
          data-action="csv-prev"
          ${csvPage === 0 ? 'disabled' : ''}
          aria-label="Предыдущие строки"
        >
          Назад</button
        ><span>Страница ${csvPage + 1} из ${pages}</span
        ><button
          type="button"
          class="button secondary"
          data-action="csv-next"
          ${csvPage === pages - 1 ? 'disabled' : ''}
          aria-label="Следующие строки"
        >
          Далее
        </button>
      </div>
    </div>
  </div>`;
}

function tasksList(dataset: Dataset) {
  return dataset.tasks
    .map(
      (task, i) =>
        html`<div class="task-line">
          <span>${String(i + 1).padStart(2, '0')}</span>
          <p>${esc(task.prompt)}</p>
        </div>`,
    )
    .join('');
}

function generator() {
  const data = generateDataset(state.config);
  return html`${heading('СОЗДАЙ СВОЙ ВАРИАНТ', 'Лаборатория данных', 'Исходники и условия меняются. Решение всегда остаётся за тобой.')}
    ${active() ? '<div class="notice">Идёт попытка на время. Генерация других вариантов доступна после завершения</div>' : ''}
    <div class="generator-layout">
      <section class="panel config-panel">
        <div class="panel-title">
          ${icon('shuffle')}
          <h2>Параметры варианта</h2>
        </div>
        <form id="generator-form">
          ${configFields(state.config)}
          <div class="generator-submit">
            <button
              type="submit"
              class="button primary full"
              ${active() ? 'disabled' : ''}
            >
              Новый вариант ${icon('arrow')}</button
            ><button
              type="button"
              class="button secondary full"
              data-action="open-variant"
              ${active() ? 'disabled' : ''}
            >
              Открыть по коду
            </button>
          </div>
        </form>
        <div class="small-note">
          «Новый вариант» меняет данные и все три условия выборок. «Открыть по
          коду» повторяет набор с указанными параметрами
        </div>
      </section>
      <div class="generator-right">
        <section class="panel dataset-panel">
          ${datasetInfo(data)}
          <div class="export-row">
            <span
              >CSV + задание + параметры<br /><small
                >Без готовой схемы и ответов</small
              ></span
            >${exportButtons()}
          </div>
        </section>
        <section class="panel">
          <div class="panel-title">
            <h2>Условия выборок</h2>
            <span class="pill subtle">3 задания</span>
          </div>
          ${tasksList(data)}
          <p class="small-note">
            После нормализации выполни выборки в Calc или SQL. В тренировке
            проверяются числовые ответы, не текст запросов
          </p>
        </section>
      </div>
    </div>
    <section class="panel rules-panel">
      <div>
        <span class="eyebrow">СНАЧАЛА ПРОЧИТАЙ</span>
        <h2>Правила предметной области</h2>
        <p>${data.domain.description}</p>
      </div>
      <ul>
        ${data.rules.map(rule => html`<li>${esc(rule)}</li>`).join('')}
      </ul>
    </section>`;
}

function quizView() {
  const quiz = state.quiz;
  if (!quiz)
    return html`${heading('КОРОТКО. ОСМЫСЛЕННО.', 'Проверим понимание?', 'Не вспоминай готовый код. Выбирай ответ и разбирай причину.')}
      <div class="quiz-intro panel">
        <div class="quiz-illustration">${icon('quiz')}</div>
        <span class="pill">БЛИЦ / МОДУЛЬ 01</span>
        <h2>Один вопрос - одна идея</h2>
        <p>
          До 8 вопросов за подход. Порядок вопросов и ответов меняется<br />Подсказки
          доступны, но самостоятельные ответы отмечаются отдельно
        </p>
        <form id="quiz-form">
          <label
            >Тема<select name="topic">
              <option>Все темы</option>
              ${topics.map(t => html`<option>${t}</option>`).join('')}
            </select></label
          ><button class="button primary" type="submit">
            Начать викторину ${icon('arrow')}
          </button>
        </form>
        <div class="intro-tags">
          <span>${questions.length} вопроса</span
          ><span>Разбор каждого ответа</span><span>Без таймера</span>
        </div>
      </div>`;
  if (quiz.completed) {
    const correct = quiz.answers.filter(a => a.correct).length;
    const independent = quiz.answers.filter(a => a.correct && !a.hint).length;
    return html`${heading('ЕЩЁ ОДИН ШАГ ВПЕРЁД', 'Блиц завершён', 'Правильный ответ важен. Понимание причины - ещё важнее.')}
      <section class="panel result-hero">
        <div class="result-score">
          ${correct}<span> / ${quiz.questions.length}</span>
        </div>
        <h2>
          ${correct === quiz.questions.length ? 'Отличный результат' : 'Есть что закрепить'}
        </h2>
        <p>
          Самостоятельно верных: ${independent}. С подсказкой:
          ${quiz.answers.filter(a => a.hint).length}
        </p>
        <div class="actions">
          ${button('new-quiz', 'Новый блиц', 'primary')}${button('view-generator', 'Перейти к практике', 'secondary')}
        </div>
      </section>
      <div class="section-heading"><h2>Разбор вопросов</h2></div>
      <div class="review-list">
        ${quiz.questions
          .map(
            (q, i) =>
              html`<article class="panel review-item">
                ${icon(quiz.answers[i].correct ? 'check' : 'close', quiz.answers[i].correct ? 'green-text' : 'orange-text')}
                <div>
                  <h3>${esc(q.question)}</h3>
                  <p>Твой ответ: ${esc(q.options[quiz.answers[i].choice])}</p>
                  <p class="bright">${esc(q.explanation)}</p>
                </div>
              </article>`,
          )
          .join('')}
      </div>`;
  }
  const index = quiz.answers.length;
  const q = quiz.questions[index];
  const pending = quiz.pending;
  return html`${heading('ТРЕНИРУЕМ ПОНИМАНИЕ', 'Блиц-викторина', 'Думай о смысле данных. Не торопись.')}
    <section class="panel quiz-card">
      <div class="quiz-meta">
        <span class="pill subtle">${q.topic}</span
        ><span
          >Вопрос ${index + 1}
          <span class="muted">/ ${quiz.questions.length}</span></span
        >
      </div>
      <progress max="${quiz.questions.length}" value="${index}"></progress>
      <h2>${esc(q.question)}</h2>
      <div class="answer-options">
        ${q.options.map((option, i) => html`<button class="answer ${pending ? (i === q.correct ? 'correct' : pending.choice === i ? 'incorrect' : '') : ''}" data-action="answer" data-choice="${i}" ${pending ? 'disabled' : ''}><span class="answer-letter">${String.fromCharCode(65 + i)}</span><span>${esc(option)}</span>${pending && i === q.correct ? icon('check') : ''}</button>`).join('')}
      </div>
      ${
        pending
          ? html`<div
              class="feedback ${pending.correct ? 'success' : 'try-again'}"
            >
              <strong
                >${pending.correct ? 'Верно. Вот почему:' : 'Разберём, почему иначе:'}</strong
              >
              <p>${esc(q.explanation)}</p>
            </div>`
          : quiz.hint
            ? html`<div class="hint-box">
                ${icon('help')}
                <p>${esc(q.hint)}</p>
              </div>`
            : ''
      }
      <div class="quiz-footer">
        ${!pending ? button('hint', `${icon('help')} Подсказка`, 'ghost', quiz.hint ? 'disabled' : '') : '<span class="small-note">Знание закрепляется через объяснение</span>'}${pending ? button('next-question', `${index + 1 === quiz.questions.length ? 'Завершить блиц' : 'Следующий вопрос'} ${icon('arrow')}`, 'primary') : '<span class="small-note">Выбери один ответ</span>'}
      </div>
    </section>`;
}

function practice() {
  const session = state.session;
  if (!session)
    return html`${heading('САМОСТОЯТЕЛЬНЫЙ РЕЖИМ', 'Практика на время', 'Тренируй первую часть: от исходной таблицы до связанной модели.')}
      <div class="practice-setup">
        <section class="panel">
          <div class="panel-title">
            ${icon('clock')}
            <h2>Новая попытка</h2>
          </div>
          <form id="practice-form">
            ${configFields(state.config, {duration: true})}<button
              class="button primary full"
              type="submit"
            >
              Запустить таймер ${icon('arrow')}
            </button>
          </form>
        </section>
        <section class="practice-guide">
          <span class="pill">КАК ЭТО РАБОТАЕТ</span>
          <h2>Твоя работа<br />Твои решения</h2>
          <ol>
            <li>
              <strong>Забери исходники</strong>
              <p>Сохрани CSV и условия, открой данные в LibreOffice Calc</p>
            </li>
            <li>
              <strong>Нормализуй самостоятельно</strong>
              <p>Определи сущности, PK и FK. Сохрани .ods и отдельные CSV</p>
            </li>
            <li>
              <strong>Выполни выборки</strong>
              <p>Введи три числовых ответа и пройди чек-лист</p>
            </li>
            <li>
              <strong>Разбери результат</strong>
              <p>
                Ответы откроются после завершения. Схему оцениваешь
                самостоятельно
              </p>
            </li>
          </ol>
          <div class="notice">
            Таймер продолжает идти при закрытии приложения и во время сна. Паузы
            нет. Это учебный лимит, не официальный регламент
          </div>
        </section>
      </div>`;
  const data = generateDataset(session.config);
  if (session.status !== 'running') return report(session, data);
  return html`${heading('ПОПЫТКА В ПРОЦЕССЕ', data.domain.name, `Вариант ${esc(session.config.seed)}, ${session.config.size} строк, работа в Calc`, html`<div class="big-timer">${icon('clock')}<span data-clock>${formatTime(remainingMs(session))}</span></div>`)}<progress
      class="session-progress"
      max="${session.minutes * 60000}"
      value="${remainingMs(session)}"
      data-time-progress
    ></progress>
    <div class="practice-active">
      <div>
        <section class="panel">
          <div class="panel-title">
            <h2>01. Исходники и условия</h2>
            ${exportButtons()}
          </div>
          <p>${data.domain.description} ${data.domain.grain}</p>
          <ul class="rules-list">
            ${data.rules.map(rule => html`<li>${esc(rule)}</li>`).join('')}
          </ul>
          <div class="small-note">
            ${session.exported ? 'Набор сохранён. Работай в отдельной книге, не меняй исходный CSV.' : 'Сначала сохрани набор. В нём нет готового решения.'}
          </div>
        </section>
        <section class="panel">
          <h2>02. Результаты выборок</h2>
          <p class="muted">Ответы проверятся только после завершения</p>
          <div class="task-inputs">
            ${data.tasks
              .map(
                (task, i) =>
                  html`<label class="task-input"
                    ><span><b>${i + 1}.</b> ${esc(task.prompt)}</span
                    ><input
                      type="text"
                      inputmode="numeric"
                      pattern="[0-9]+"
                      data-answer="${task.id}"
                      value="${esc(session.answers[task.id] ?? '')}"
                      placeholder="Целое число"
                      aria-label="Ответ на задание ${i + 1}"
                  /></label>`,
              )
              .join('')}
          </div>
        </section>
      </div>
      <aside class="panel checklist-panel">
        <span class="eyebrow">САМОПРОВЕРКА</span>
        <h2>03. Нормализация</h2>
        <p>Отметь только то, что действительно сделал</p>
        ${checklist.map((text, i) => html`<label class="check-item"><input type="checkbox" data-check="${i}" ${session.checks.includes(i) ? 'checked' : ''} /><span>${text}</span></label>`).join('')}
        <div class="notice">
          Это твоя самооценка. Приложение не проверяет структуру созданных
          таблиц
        </div>
        ${button('finish', 'Завершить попытку', 'primary full')}<small
          >Можно завершить раньше таймера</small
        >
      </aside>
    </div>`;
}

function report(session: PracticeSession, data: Dataset) {
  const grades = gradeTasks(data, session.answers);
  const score = grades.filter(g => g.correct).length;
  const status = {
    running: 'Попытка идёт',
    submitted: 'Попытка завершена',
    expired: 'Время вышло',
    interrupted: 'Попытка прервана',
  }[session.status];
  return html`${heading('РАЗБОР ПРАКТИКИ', status, `${data.domain.name}, ${esc(session.config.seed)}, ${dateLabel(session.startedAt)}`, button('new-session', 'Новая попытка', 'primary'))}
    <div class="report-stats">
      <div class="panel">
        <span class="eyebrow">ВЫБОРКИ</span
        ><strong>${score}<small> / 3</small></strong>
        <p>Верных числовых ответов</p>
      </div>
      <div class="panel">
        <span class="eyebrow">ВРЕМЯ</span
        ><strong>${formatTime(session.finishedAt! - session.startedAt)}</strong>
        <p>Из ${session.minutes} минут</p>
      </div>
      <div class="panel">
        <span class="eyebrow">САМОПРОВЕРКА</span
        ><strong>${session.checks.length}<small> / 4</small></strong>
        <p>Отмечено тобой, не проверено автоматически</p>
      </div>
    </div>
    <div class="review-list">
      ${grades
        .map(
          (g, i) =>
            html`<section class="panel review-item">
              ${icon(g.correct ? 'check' : 'close', g.correct ? 'green-text' : 'orange-text')}
              <div>
                <span class="eyebrow">ЗАДАНИЕ ${i + 1}</span>
                <h3>${esc(g.prompt)}</h3>
                <div class="answer-comparison">
                  <span
                    >Твой ответ <b>${esc(g.submitted || 'Не указан')}</b></span
                  ><span>Верный ответ <b>${g.answer}</b></span>
                </div>
                <p>${g.explanation}</p>
              </div>
            </section>`,
        )
        .join('')}
    </div>
    <section class="panel reflection">
      <h2>Объясни своё решение</h2>
      ${data.questions.map(q => html`<p>${esc(q)}</p>`).join('')}
      <div class="notice">
        Результат выборок не доказывает правильность нормализации. Открой свою
        .ods, проверь PK/FK и объясни зависимости. Официальные экзаменационные
        баллы не рассчитываются
      </div>
    </section>`;
}

function historyTable(limit = 100) {
  const rows = [
    ...state.history.map(s => ({
      kind: 'practice',
      id: s.id,
      time: s.finishedAt!,
      name: domains.find(d => d.id === s.config.domain)?.name ?? '',
      sub: s.config.seed,
      result: `${gradeTasks(generateDataset(s.config), s.answers).filter(g => g.correct).length} / 3`,
      badge: s.status === 'expired' ? 'Время вышло' : 'Завершено',
    })),
    ...state.quizHistory.map(q => ({
      kind: 'quiz',
      id: '',
      time: q.time,
      name: 'Блиц-викторина',
      sub: q.topic,
      result: `${q.correct} / ${q.total}`,
      badge: 'Пройдено',
    })),
  ]
    .sort((a, b) => b.time - a.time)
    .slice(0, limit);
  return html`<div class="panel history-panel">
    ${
      !rows.length
        ? html`<div class="empty-state">
            ${icon('chart')}
            <h3>Здесь начнётся твоя история</h3>
            <p>Пройди первый блиц или закончи практическую попытку</p>
          </div>`
        : html`<div class="table-scroll">
            <table class="history-table">
              <thead>
                <tr>
                  <th>ПОПЫТКА</th>
                  <th>ДАТА</th>
                  <th>РЕЗУЛЬТАТ</th>
                  <th>СТАТУС</th>
                </tr>
              </thead>
              <tbody>
                ${rows
                  .map(
                    row =>
                      html`<tr>
                        <td>
                          <div class="history-name">
                            ${icon(row.kind === 'quiz' ? 'quiz' : 'database')}
                            <div>
                              ${row.kind === 'practice' ? html`<button class="text-button history-link" data-action="open-report" data-id="${esc(row.id)}">${esc(row.name)}</button>` : esc(row.name)}<small
                                >${esc(row.sub)}</small
                              >
                            </div>
                          </div>
                        </td>
                        <td>${dateLabel(row.time)}</td>
                        <td><b>${row.result}</b></td>
                        <td><span class="pill subtle">${row.badge}</span></td>
                      </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>`
    }
  </div>`;
}

function history() {
  const s = stats();
  const independent = state.quizHistory.filter(
    q => q.correct === q.total && q.hints === 0,
  ).length;
  const bestScore = Math.max(
    0,
    ...state.history.map(
      s =>
        gradeTasks(generateDataset(s.config), s.answers).filter(g => g.correct)
          .length,
    ),
  );
  const domainCount = new Set(state.history.map(s => s.config.domain)).size;
  const badges: [string, string, string, number, number][] = [
    [
      'Первый шаг',
      'Завершить первый блиц',
      'quiz',
      Math.min(state.quizHistory.length, 1),
      1,
    ],
    [
      'Без подсказок',
      'Весь блиц верно и самостоятельно',
      'medal',
      Math.min(independent, 1),
      1,
    ],
    [
      'Точный результат',
      'Все три выборки верны в одной попытке',
      'check',
      bestScore,
      3,
    ],
    [
      'Новый контекст',
      'Завершить практику в трёх областях',
      'layers',
      domainCount,
      3,
    ],
  ];
  return html`${heading('НЕ ТОЛЬКО ЦИФРЫ', 'Твой прогресс', 'Отмечаем практику и самостоятельность. Не выдаём активность за освоение.')}
    <div class="achievement-grid">
      ${badges
        .map(
          ([name, description, glyph, value, goal]) =>
            html`<article
              class="panel achievement ${value === goal ? 'earned' : ''}"
            >
              <div class="badge-art">${icon(glyph)}</div>
              <div class="achievement-copy">
                <div class="achievement-title">
                  <h3>${name}</h3>
                  <span class="achievement-status"
                    >${value === goal ? `${icon('check')} Открыто` : `${value} / ${goal}`}</span
                  >
                </div>
                <p>${description}</p>
                <progress
                  aria-label="${name}"
                  value="${value}"
                  max="${goal}"
                ></progress>
              </div>
            </article>`,
        )
        .join('')}
    </div>
    <div class="section-heading">
      <div>
        <h2>История занятий</h2>
        <p>
          ${s.answered} ответов в завершённых блицах, ${state.exports}
          сохранений учебных файлов
        </p>
      </div>
    </div>
    ${historyTable()}
    <div class="notice">
      Прогресс хранится локально в этом приложении. В браузерном предпросмотре -
      отдельно, в текущем браузере. Чек-лист нормализации - самооценка, не
      автоматический зачёт
    </div>`;
}

function render() {
  closeSelectMenu();
  if (!label[state.view]) state.view = 'home';
  query('#app').innerHTML = shell(
    {home, generator, quiz: quizView, practice, history}[state.view](),
  );
  enhanceSelects(query('#app'));
  enhanceNumbers(query('#app'));
}

function complete() {
  if (!active()) return;
  state.session = finishSession(state.session!);
  if (!state.history.some(s => s.id === state.session!.id))
    state.history.push(structuredClone(state.session!));
  state.view = 'practice';
  save();
  render();
}

async function exportCurrent(fileName?: string) {
  const config =
    active() && state.view === 'practice'
      ? state.session!.config
      : state.config;
  if (window.desktop) {
    const result = await window.desktop.exportDataset(config, state.delimiter);
    if (result.canceled) return;
    toast(`Набор сохранён: ${result.directory}`);
  } else {
    const file = exportFiles(config, state.delimiter).find(
      f => f.name === fileName,
    );
    if (!file) throw new Error('Файл не найден.');
    const url = URL.createObjectURL(
      new Blob([file.content], {
        type: file.name.endsWith('.csv')
          ? 'text/csv;charset=utf-8'
          : 'text/plain;charset=utf-8',
      }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.domain}-${config.seed}-${file.name}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Файл передан браузеру для скачивания.');
  }
  state.exports++;
  if (active() && state.view === 'practice') state.session!.exported = true;
  save();
  render();
}

document.addEventListener('click', async event => {
  const target =
    event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>('[data-view], [data-action]')
      : null;
  if (!target || target.disabled) return;
  try {
    if (active() && Date.now() >= state.session!.deadline) {
      complete();
      return;
    }
    if (target.dataset.view) {
      if (active() && target.dataset.view === 'quiz') {
        toast('Блиц и подсказки доступны после завершения попытки.');
        return;
      }
      state.view = target.dataset.view as View;
      save();
      render();
      return;
    }
    switch (target.dataset.action) {
      case 'csv-prev':
      case 'csv-next': {
        const scroll = query('.csv-scroll');
        const left = scroll.scrollLeft;
        csvPage += target.dataset.action === 'csv-next' ? 1 : -1;
        query('.csv-preview').outerHTML = datasetInfo(
          generateDataset(state.config),
        );
        query('.csv-scroll').scrollLeft = left;
        const nextFocus = query<HTMLButtonElement>(
          `[data-action="${target.dataset.action}"]`,
        );
        (nextFocus.disabled ? query('.csv-scroll') : nextFocus).focus({
          preventScroll: true,
        });
        return;
      }
      case 'domain':
        if (active()) {
          state.view = 'practice';
          break;
        }
        state.config.domain = normalizeConfig({
          domain: target.dataset.domain,
        }).domain;
        state.view = 'generator';
        break;
      case 'random-seed':
        if (target.closest('form')!.id === 'generator-form') {
          applyGenerator(true);
          return;
        }
        query<HTMLInputElement>('[name=seed]', target.closest('form')!).value =
          freshSeed();
        return;
      case 'open-variant':
        applyGenerator(false);
        return;
      case 'export':
      case 'download':
        target.disabled = true;
        try {
          await exportCurrent(target.dataset.file);
        } finally {
          target.disabled = false;
        }
        return;
      case 'answer': {
        const quiz = state.quiz;
        if (!quiz || quiz.completed || quiz.pending) return;
        const q = quiz.questions[quiz.answers.length];
        quiz.pending = {
          choice: Number(target.dataset.choice),
          correct: Number(target.dataset.choice) === q.correct,
          hint: !!quiz.hint,
        };
        break;
      }
      case 'hint':
        if (state.quiz) state.quiz.hint = true;
        break;
      case 'next-question': {
        const quiz = state.quiz;
        if (!quiz?.pending || quiz.completed) return;
        quiz.answers.push(quiz.pending);
        quiz.pending = null;
        quiz.hint = false;
        if (quiz.answers.length === quiz.questions.length) {
          quiz.completed = true;
          state.quizHistory.push({
            time: Date.now(),
            topic: quiz.topic,
            correct: quiz.answers.filter(a => a.correct).length,
            total: quiz.questions.length,
            hints: quiz.answers.filter(a => a.hint).length,
          });
        }
        break;
      }
      case 'new-quiz':
        state.quiz = null;
        break;
      case 'view-generator':
        state.view = 'generator';
        break;
      case 'finish':
        query<HTMLDialogElement>('#confirm-dialog').showModal();
        return;
      case 'cancel-finish':
        query<HTMLDialogElement>('#confirm-dialog').close();
        return;
      case 'confirm-finish':
        complete();
        return;
      case 'new-session':
        state.session = null;
        state.config.seed = freshSeed();
        break;
      case 'open-report':
        if (active()) {
          toast('Сначала заверши текущую попытку.');
          return;
        }
        state.session = structuredClone(
          state.history.find(s => s.id === target.dataset.id) ?? null,
        );
        state.view = 'practice';
        break;
      default:
        return;
    }
    save();
    render();
  } catch (error) {
    toast(errorMessage(error), true);
  }
});

function applyGenerator(randomize: boolean) {
  if (active()) {
    toast('Сначала заверши текущую попытку.');
    return;
  }
  const form = query<HTMLFormElement>('#generator-form');
  if (!form.reportValidity()) return;
  const values = Object.fromEntries(new FormData(form));
  state.config = randomize
    ? newVariant(values, state.config, freshSeed)
    : normalizeConfig(values);
  state.delimiter = String(values.delimiter);
  save();
  render();
  toast(
    randomize
      ? 'Новый вариант готов. Данные и условия обновлены.'
      : 'Вариант открыт по коду.',
  );
}

document.addEventListener('change', event => {
  if (!(event.target instanceof HTMLSelectElement)) return;
  const form = event.target.closest<HTMLFormElement>('#generator-form');
  if (!form || event.target.name !== 'domain') return;
  if (active()) {
    render();
    toast('Сначала заверши текущую попытку.');
    return;
  }
  const previousDomain = state.config.domain;
  try {
    if (!form.reportValidity()) {
      event.target.value = previousDomain;
      return;
    }
    applyGenerator(true);
    query('#generator-form [data-select-name=domain]').focus({
      preventScroll: true,
    });
  } catch (error) {
    event.target.value = previousDomain;
    toast(errorMessage(error), true);
  }
});

document.addEventListener('submit', event => {
  event.preventDefault();
  try {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (active()) {
      toast('Сначала заверши текущую попытку.');
      return;
    }
    const values = Object.fromEntries(new FormData(form));
    if (form.id === 'generator-form') {
      applyGenerator(true);
    }
    if (form.id === 'quiz-form') {
      state.quiz = {
        questions: makeQuiz(freshSeed(), String(values.topic)),
        topic: String(values.topic),
        answers: [],
        pending: null,
        hint: false,
        completed: false,
      };
      save();
      render();
    }
    if (form.id === 'practice-form') {
      const config = normalizeConfig(values);
      state.session = startSession(config, Number(values.minutes));
      state.config = config;
      save();
      render();
    }
  } catch (error) {
    toast(errorMessage(error), true);
  }
});

document.addEventListener('input', event => {
  if (!(event.target instanceof HTMLInputElement)) return;
  if (!active()) return;
  if (Date.now() >= state.session!.deadline) {
    complete();
    return;
  }
  if (event.target.dataset.answer) {
    state.session!.answers[event.target.dataset.answer] =
      event.target.value.slice(0, 20);
    save();
  }
  if (event.target.dataset.check !== undefined) {
    const value = Number(event.target.dataset.check);
    state.session!.checks = event.target.checked
      ? [...new Set([...state.session!.checks, value])]
      : state.session!.checks.filter(i => i !== value);
    save();
  }
});
window.addEventListener('hashchange', () => {
  if (location.hash === '#home') {
    state.view = 'home';
    save();
    render();
  }
});
setInterval(() => {
  if (!active()) return;
  const remaining = remainingMs(state.session);
  if (!remaining) {
    complete();
    return;
  }
  document.querySelectorAll<HTMLElement>('[data-clock]').forEach(el => {
    el.textContent = formatTime(remaining);
  });
  document
    .querySelectorAll<HTMLProgressElement>('[data-time-progress]')
    .forEach(el => {
      el.value = remaining;
    });
}, 250);
if (active() && !remainingMs(state.session)) complete();
else render();
