import {query} from '../dom.js';
import {isCellError} from '../spreadsheet/index.js';
import {SheetSession} from './session.js';
import {functionDialog} from './function-dialog.js';
import {createRangePicker} from './range-picker.js';
import {type WizardContext} from './wizard-model.js';
import {cellEditor} from './cell-editor.js';
import {gridSelection} from './grid-selection.js';
import {rangeTransfer} from './transfer.js';
import {errorExplanation} from './error-messages.js';
import {errorTooltip} from './error-tooltip.js';

import {words} from './labels.js';
declare global {
  interface Window {
    sheetDesktop?: {
      menu: (language: string, sheet: string, count: number) => void;
      newDocument: (language: string) => void;
      onCommand: (callback: (command: string, sheet?: string) => void) => void;
    };
  }
}
const parameters = new URLSearchParams(location.search);
const blank = parameters.get('blank') === '1';
let language: keyof typeof words =
  parameters.get('language') === 'en' ? 'en' : 'ru';
const session = new SheetSession(
  blank ? (language === 'ru' ? 'Лист1' : 'Sheet1') : undefined,
);
const book = session.book;
const transfer = rangeTransfer(session);
let sheet = blank ? book.getSheetNames()[0] : 'Практика';
let selected = blank ? 'A1' : 'H2';
const selections = new Map<string, string>();
let draft = false;
const formula = query<HTMLInputElement>('#formula');
const address = query<HTMLInputElement>('#address');
const grid = query<HTMLTableElement>('#grid');
const options = query<HTMLDetailsElement>('#options');
const cells = new Map<string, HTMLTableCellElement>();
const rangePicker = createRangePicker(grid, () => sheet);
let referenceHome: {sheet: string; address: string} | null = null;
const returnToReference = () => {
  if (!referenceHome) return;
  const original = {
    language,
    ...referenceHome,
    formula: formula.value,
    sheets: [],
    cells: [],
  };
  referenceHome = null;
  restoreCell(original);
};
function restoreCell(original: WizardContext) {
  sheet = original.sheet;
  selected = original.address;
  render();
  formula.value = original.formula;
  draft = formula.value !== session.source(sheet, selected, language);
  if (draft) editing.preview();
  cells.get(selected)?.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
    container: 'nearest',
  } as ScrollIntoViewOptions);
}
query('#function-wizard').onclick = functionDialog(
  book,
  () => {
    returnToReference();
    return {language, sheet, address: selected, formula: formula.value};
  },
  (value, original) => {
    restoreCell(original);
    formula.value = value;
    draft = true;
    return commit();
  },
  restoreCell,
  done => {
    status(words[language].pickRange);
    return rangePicker.start(done);
  },
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
const editing = cellEditor(
  formula,
  () => cells.get(selected)!,
  () => language,
  () => {
    draft = true;
  },
  tab => {
    if (!commit()) return;
    const column = Math.min(76, Math.max(65, selected.charCodeAt(0) + tab));
    select(String.fromCharCode(column) + selected.slice(1));
  },
  () => {
    render();
    cells.get(selected)!.focus();
  },
);
const selection = gridSelection(grid, selected, select);
const errors = errorTooltip(grid);
function render() {
  errors.hide();
  editing.reset();
  for (const [key, cell] of cells) {
    const value = book.getValue(sheet, key);
    cell.textContent = isCellError(value) ? value.code : String(value ?? '');
    if (isCellError(value)) {
      cell.dataset.error = errorExplanation(value.code, language);
      cell.setAttribute('aria-description', cell.dataset.error);
    } else {
      delete cell.dataset.error;
      cell.removeAttribute('aria-description');
    }
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
  const title = blank
    ? `${words[language].newDocument} ${parameters.get('document') || '1'}`
    : words[language].title;
  document.title = `${session.dirty ? '* ' : ''}${title} - formatted Sheets`;
  query('#title').textContent = `${session.dirty ? '* ' : ''}${title}`;
  document
    .querySelectorAll<HTMLButtonElement>('[data-sheet]')
    .forEach(button =>
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.sheet === sheet),
      ),
    );
  status(words[language].ready);
  selection.paint();
}
function commit() {
  returnToReference();
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
  if (!cells.has(key) || !commit()) return false;
  selected = key;
  selection.reset(key);
  render();
  cells.get(key)!.focus({preventScroll: true});
  cells.get(key)!.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
    container: 'nearest',
  } as ScrollIntoViewOptions);
  return true;
}
function edit(replacement?: string) {
  editing.start(replacement);
}
function addTab(name: string) {
  const button = document.createElement('button');
  button.textContent = name;
  button.dataset.sheet = name;
  button.onclick = () => {
    if (rangePicker.active) {
      rangePicker.clear();
      sheet = name;
      render();
      status(words[language].pickRange);
      return;
    }
    if (referenceHome || editing.reference()) {
      const text = formula.value;
      referenceHome ??= {sheet, address: selected};
      sheet = name;
      render();
      formula.value = text;
      formula.focus();
      formula.setSelectionRange(text.length, text.length);
      draft = true;
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
for (const name of book.getSheetNames()) addTab(name);
const sheetDialog = query<HTMLDialogElement>('#sheet-dialog');
const sheetName = query<HTMLInputElement>('#sheet-name');
let sheetAction = {command: '', target: ''};
query('#sheet-dialog-cancel').onclick = () => sheetDialog.close();
query('#sheet-action').addEventListener('submit', event => {
  event.preventDefault();
  const {command, target} = sheetAction;
  const name = sheetName.value.trim();
  if (
    command === 'rename-sheet' &&
    (!name ||
      name.length > 100 ||
      [...name].some(c => c.charCodeAt(0) < 32) ||
      book
        .getSheetNames()
        .some(n => n !== target && n.toLowerCase() === name.toLowerCase()))
  ) {
    query('#sheet-dialog-error').textContent = words[language].invalidName;
    sheetName.focus();
    return;
  }
  if (!commit()) {
    sheetDialog.close();
    return;
  }
  try {
    if (command === 'rename-sheet') {
      session.renameSheet(target, name);
      if (sheet === target) sheet = name;
      if (selections.has(target)) selections.set(name, selections.get(target)!);
    } else {
      const names = book.getSheetNames();
      session.deleteSheet(target);
      if (sheet === target) {
        sheet = book.getSheetNames()[Math.max(0, names.indexOf(target) - 1)];
        selected = selections.get(sheet) ?? 'A1';
      }
    }
    if (target !== name || command === 'delete-sheet')
      selections.delete(target);
    query('#sheets').replaceChildren();
    for (const title of book.getSheetNames()) addTab(title);
    render();
    query('#sheets [aria-pressed="true"]').scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      container: 'nearest',
    } as ScrollIntoViewOptions);
    sheetDialog.close();
    cells.get(selected)?.focus({preventScroll: true});
  } catch (error) {
    query('#sheet-dialog-error').textContent = String(error);
  }
});
query('#sheets').addEventListener('contextmenu', event => {
  const tab = (event.target as Element).closest<HTMLElement>('[data-sheet]');
  if (!tab) return;
  event.preventDefault();
  if (!rangePicker.active && !document.body.inert)
    window.sheetDesktop?.menu(
      language,
      tab.dataset.sheet!,
      book.getSheetNames().length,
    );
});
window.sheetDesktop?.onCommand((command, target) => {
  if (command === 'new-document') {
    window.sheetDesktop?.newDocument(language);
    return;
  }
  if (rangePicker.active || document.body.inert || sheetDialog.open) return;
  if (['rename-sheet', 'delete-sheet'].includes(command)) {
    if (
      !target ||
      !book.getSheetNames().includes(target) ||
      (command === 'delete-sheet' && book.getSheetNames().length === 1)
    )
      return;
    const rename = command === 'rename-sheet';
    sheetAction = {command, target};
    query('#sheet-dialog-title').textContent =
      words[language][rename ? 'renameSheet' : 'deleteSheet'];
    query('#sheet-dialog-detail').textContent = rename
      ? target
      : `${target}: ${words[language].deleteWarning}`;
    query('#sheet-name-label').textContent = words[language].sheetName;
    query('#sheet-name-label').hidden = sheetName.hidden = !rename;
    sheetName.value = target;
    query('#sheet-dialog-error').textContent = '';
    query('#sheet-dialog-cancel').textContent = words[language].cancel;
    query('#sheet-dialog-apply').textContent =
      words[language][rename ? 'apply' : 'deleteSheet'];
    sheetDialog.showModal();
    if (rename) {
      sheetName.focus();
      sheetName.select();
    } else query<HTMLButtonElement>('#sheet-dialog-cancel').focus();
    return;
  }
  if (
    command !== 'add-sheet' ||
    rangePicker.active ||
    document.body.inert ||
    !commit()
  )
    return;
  try {
    const name = session.addSheet(language);
    selections.set(sheet, selected);
    addTab(name);
    sheet = name;
    select('A1');
    query('#sheets').lastElementChild?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      container: 'nearest',
    } as ScrollIntoViewOptions);
  } catch (error) {
    status(String(error));
  }
});
grid.addEventListener('click', event => {
  const cell = (event.target as Element).closest<HTMLElement>('[data-cell]');
  if (cell) select(cell.dataset.cell!);
});
grid.parentElement!.addEventListener(
  'pointerdown',
  event => {
    if (
      rangePicker.active ||
      document.body.inert ||
      event.button !== 0 ||
      event.target instanceof HTMLInputElement ||
      !(event.target as Element).closest('[data-cell]')
    )
      return;
    const slot = editing.reference();
    if (!slot) return;
    const original = {
      language,
      sheet: referenceHome?.sheet ?? sheet,
      address: referenceHome?.address ?? selected,
      formula: formula.value,
      sheets: [],
      cells: [],
    };
    rangePicker.start(reference => {
      const sourceSheet = sheet;
      referenceHome = null;
      restoreCell(original);
      if (reference) {
        const split = reference.lastIndexOf("'.") + 2;
        editing.insertReference(
          slot,
          (sourceSheet === original.sheet ? '' : reference.slice(0, split)) +
            reference.slice(split).replaceAll('$', ''),
        );
      } else {
        formula.focus();
        formula.setSelectionRange(slot.start, slot.end);
      }
    }, true);
  },
  true,
);
grid.addEventListener('dblclick', event => {
  if ((event.target as Element).closest('[data-cell]')) edit();
});
grid.addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement) return;
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
    if (event.shiftKey && event.key.startsWith('Arrow')) {
      selection.move(c - col, r - row);
      return;
    }
    select(
      `${String.fromCharCode(65 + Math.min(11, Math.max(0, c)))}${Math.min(100, Math.max(1, r))}`,
    );
  } else if (['Delete', 'Backspace'].includes(event.key)) {
    event.preventDefault();
    transfer.clear(sheet, selection.range);
    render();
    cells.get(selected)!.focus();
  } else if (event.key === 'F2' || event.key.length === 1) {
    event.preventDefault();
    edit(event.key === 'F2' ? undefined : event.key);
  }
});
// cellEditor synchronizes both inputs and reports each change once.
grid.addEventListener('paste', event => {
  if (!event.clipboardData) return;
  event.preventDefault();
  try {
    transfer.paste(sheet, selected, event.clipboardData, false);
    render();
  } catch (error) {
    status(String(error));
  }
});
grid.addEventListener('copy', event => {
  if (event.target instanceof HTMLInputElement || !event.clipboardData) return;
  event.preventDefault();
  transfer.copy(sheet, selection.range, event.clipboardData);
});
for (const action of ['fill', 'values'] as const)
  query(`#range-${action}`).onclick = () => {
    if (rangePicker.active || !commit()) return;
    try {
      transfer[action](sheet, selection.range);
      render();
    } catch (error) {
      status(String(error));
    }
  };
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
  if (document.body.inert || sheetDialog.open) return;
  if (event.isComposing) return;
  if (event.key === 'Escape') {
    returnToReference();
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
