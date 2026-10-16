import {query} from '../dom.js';
import {isCellError} from '../spreadsheet/index.js';
import {SheetSession, sheetNames} from './session.js';
import {functionDialog} from './function-dialog.js';
import {createRangePicker} from './range-picker.js';
import {type WizardContext} from './wizard-model.js';

import {words} from './labels.js';
let language: keyof typeof words = 'ru';
const session = new SheetSession();
const book = session.book;
let sheet = 'Практика';
let selected = 'H2';
const selections = new Map<string, string>();
let draft = false;
const formula = query<HTMLInputElement>('#formula');
const address = query<HTMLInputElement>('#address');
const grid = query<HTMLTableElement>('#grid');
const options = query<HTMLDetailsElement>('#options');
const cells = new Map<string, HTMLTableCellElement>();
const rangePicker = createRangePicker(grid, () => sheet);
function restoreCell(original: WizardContext) {
  sheet = original.sheet;
  selected = original.address;
  render();
  formula.value = original.formula;
  draft = formula.value !== session.source(sheet, selected, language);
}
query('#function-wizard').onclick = functionDialog(
  book,
  () => ({language, sheet, address: selected, formula: formula.value}),
  (value, original) => {
    restoreCell(original);
    formula.value = value;
    draft = true;
    return commit();
  },
  restoreCell,
  done => rangePicker.start(done),
);
const head = grid.createTHead().insertRow();
for (let col = 0; col <= 12; col++) {
  const cell = document.createElement('th');
  cell.scope = 'col';
  cell.textContent = col ? String.fromCharCode(64 + col) : '';
  head.append(cell);
}
const body = grid.createTBody();
for (let row = 1; row <= 100; row++) {
  const tr = body.insertRow();
  const th = document.createElement('th');
  th.scope = 'row';
  th.textContent = String(row);
  tr.append(th);
  for (let col = 0; col < 12; col++) {
    const cell = tr.insertCell();
    cell.dataset.cell = `${String.fromCharCode(65 + col)}${row}`;
    cell.setAttribute('role', 'gridcell');
    cells.set(cell.dataset.cell, cell);
  }
}
function status(text: string) {
  query('#status').textContent = text;
  query('#status').title = text;
}
function render() {
  for (const [key, cell] of cells) {
    const value = book.getValue(sheet, key);
    cell.textContent = isCellError(value) ? value.code : String(value ?? '');
    cell.classList.toggle('number', typeof value === 'number');
    cell.tabIndex = key === selected ? 0 : -1;
    cell.setAttribute('aria-selected', String(key === selected));
    cell.setAttribute('aria-label', `${key}: ${cell.textContent}`);
  }
  address.value = selected;
  formula.value = session.source(sheet, selected, language);
  draft = false;
  query('#selection').textContent = `${sheet}, ${selected}`;
  query<HTMLButtonElement>('#undo').disabled = !session.canUndo;
  document.title = `${session.dirty ? '* ' : ''}${words[language].title} - formatted Sheets`;
  query('#title').textContent =
    `${session.dirty ? '* ' : ''}${words[language].title}`;
  document
    .querySelectorAll<HTMLButtonElement>('[data-sheet]')
    .forEach(button =>
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.sheet === sheet),
      ),
    );
  status(words[language].ready);
}
function commit() {
  if (!draft) return true;
  try {
    session.write(sheet, selected, formula.value);
    render();
    return true;
  } catch (error) {
    status(String(error));
    formula.focus();
    return false;
  }
}
function select(key: string) {
  if (!cells.has(key) || !commit()) return;
  selected = key;
  render();
  cells.get(key)!.focus({preventScroll: true});
  cells.get(key)!.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
    container: 'nearest',
  } as ScrollIntoViewOptions);
}
function edit(replacement?: string) {
  formula.focus();
  if (replacement !== undefined) {
    formula.value = replacement;
    draft = true;
  } else formula.select();
}
for (const name of sheetNames) {
  const button = document.createElement('button');
  button.textContent = name;
  button.dataset.sheet = name;
  button.onclick = () => {
    if (rangePicker.active) {
      rangePicker.clear();
      sheet = name;
      render();
      return;
    }
    if (commit()) {
      selections.set(sheet, selected);
      sheet = name;
      select(selections.get(sheet) ?? 'A1');
    }
  };
  query('#sheets').append(button);
}
grid.addEventListener('click', event => {
  const cell = (event.target as Element).closest<HTMLElement>('[data-cell]');
  if (cell) select(cell.dataset.cell!);
});
grid.addEventListener('dblclick', event => {
  if ((event.target as Element).closest('[data-cell]')) edit();
});
grid.addEventListener('keydown', event => {
  if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey)
    return;
  const col = selected.charCodeAt(0) - 65;
  const row = Number(selected.slice(1));
  const moves: Record<string, [number, number]> = {
    ArrowUp: [col, row - 1],
    ArrowDown: [col, row + 1],
    ArrowLeft: [col - 1, row],
    ArrowRight: [col + 1, row],
    Enter: [col, row + (event.shiftKey ? -1 : 1)],
  };
  if (moves[event.key]) {
    event.preventDefault();
    const [c, r] = moves[event.key];
    select(
      `${String.fromCharCode(65 + Math.min(11, Math.max(0, c)))}${Math.min(100, Math.max(1, r))}`,
    );
  } else if (['Delete', 'Backspace'].includes(event.key)) {
    event.preventDefault();
    edit('');
    commit();
    cells.get(selected)!.focus();
  } else if (event.key === 'F2' || event.key.length === 1) {
    event.preventDefault();
    edit(event.key === 'F2' ? undefined : event.key);
  }
});
formula.addEventListener('input', () => {
  draft = true;
});
grid.addEventListener('paste', event => {
  const value = event.clipboardData?.getData('text/plain') ?? '';
  event.preventDefault();
  if (/[\t\r\n]/.test(value)) status(words[language].paste);
  else {
    edit(value);
    commit();
  }
});
formula.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    if (commit()) cells.get(selected)!.focus({preventScroll: true});
  }
});
formula.addEventListener('paste', event => {
  if (/[\t\r\n]/.test(event.clipboardData?.getData('text/plain') ?? '')) {
    event.preventDefault();
    status(words[language].paste);
  }
});
query('#formula-bar').addEventListener('submit', event => {
  event.preventDefault();
  if (document.activeElement === address) {
    const key = address.value.toUpperCase();
    if (cells.has(key)) select(key);
    else status(words[language].invalid);
  } else if (commit()) cells.get(selected)!.focus();
});
query('#cancel').onclick = () => {
  render();
  cells.get(selected)!.focus();
};
query('#undo').onclick = () => {
  if (draft) {
    render();
    return;
  }
  const previous = session.undo();
  if (!previous) return;
  sheet = previous.sheet;
  selected = previous.address;
  render();
};
function translate() {
  document.documentElement.lang = language;
  document.querySelectorAll<HTMLElement>('[data-label]').forEach(element => {
    element.textContent =
      words[language][element.dataset.label as keyof typeof words.ru];
  });
  for (const id of ['address', 'formula', 'grid', 'sheets'] as const)
    query('#' + id).setAttribute('aria-label', words[language][id]);
  query('#function-wizard').setAttribute('aria-label', words[language].wizard);
  query('#function-wizard').title = words[language].wizard;
  document
    .querySelectorAll<HTMLButtonElement>('[data-language]')
    .forEach(button =>
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.language === language),
      ),
    );
  render();
}
document
  .querySelectorAll<HTMLButtonElement>('[data-language]')
  .forEach(button => {
    button.onclick = () => {
      if (commit()) {
        language = button.dataset.language as keyof typeof words;
        options.open = false;
        translate();
        query('summary').focus();
      }
    };
  });
document.addEventListener('click', event => {
  if (!options.contains(event.target as Node)) options.open = false;
});
document.addEventListener('keydown', event => {
  if (document.body.inert) return;
  if (event.isComposing) return;
  if (event.key === 'Escape') {
    if (options.open) {
      options.open = false;
      query('summary').focus();
      return;
    }
    render();
    cells.get(selected)!.focus();
  }
  if (
    (event.ctrlKey || event.metaKey) &&
    !event.shiftKey &&
    event.key.toLowerCase() === 'z' &&
    !(event.target instanceof HTMLInputElement)
  ) {
    event.preventDefault();
    query<HTMLButtonElement>('#undo').click();
  }
});
window.addEventListener('beforeunload', event => {
  if (session.dirty || draft) {
    event.preventDefault();
    event.returnValue = '';
  }
});
translate();
