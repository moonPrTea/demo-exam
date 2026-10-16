import {query} from '../dom.js';
import {Workbook, isCellError} from '../spreadsheet/index.js';
import {
  buildFunction,
  functions,
  readFunction,
  type FunctionName,
  type WizardContext,
} from './wizard-model.js';

const text = {
  ru: [
    'Мастер функций',
    'Поиск функции',
    'Формула',
    'Отмена',
    'Вставить',
    'Результат',
    'Ничего не найдено',
    'Ссылки: A1 или Категории.$B$2:$B$4. Текст заключай в двойные кавычки. Аргументы разделяй точкой с запятой. Для точного ПОИСКПОЗ укажи 0',
    'Проверь аргументы, скобки и разделители ;',
    'Доступны только ИНДЕКС и ПОИСКПОЗ',
    'Значение не найдено в диапазоне, проверь текст и пробелы',
  ],
  en: [
    'Function wizard',
    'Find a function',
    'Formula',
    'Cancel',
    'Insert',
    'Result',
    'No functions found',
    'References: A1 or Категории.$B$2:$B$4. Enclose text in double quotes. Separate arguments with semicolons. Use 0 for an exact MATCH',
    'Check arguments, parentheses and semicolon separators',
    'Only INDEX and MATCH are supported',
    'Value not found in the range; check text and whitespace',
  ],
};
const book = new Workbook();
let context: WizardContext;
let current: FunctionName = 'INDEX';
let initialized = false;
const drafts = {INDEX: ['', '', ''], MATCH: ['', '', '0']};
const expression = query<HTMLTextAreaElement>('#expression');
const insert = query<HTMLButtonElement>('#insert');
function preview() {
  insert.disabled = true;
  const result = query('#result');
  try {
    if (!expression.value.startsWith('=')) throw new Error('=');
    book.setFormula(context.sheet, context.address, expression.value);
    const value = book.getValue(context.sheet, context.address);
    const error = isCellError(value);
    result.dataset.error = String(error);
    result.textContent = `${text[context.language][5]}: ${error ? value.code : String(value ?? '')}`;
    const hint = error ? ['#PARSE!', '#NAME?', '#N/A'].indexOf(value.code) : -1;
    if (hint >= 0)
      result.textContent += `: ${text[context.language][8 + hint]}`;
    insert.disabled = error;
  } catch (error) {
    result.dataset.error = 'true';
    result.textContent = String(error);
  }
}
function fields() {
  const definition = functions[current];
  query('#description').textContent = definition[context.language][1];
  query('#arguments').replaceChildren(
    ...drafts[current].map((value, index) => {
      const label = document.createElement('label');
      label.textContent = definition[context.language][index + 2];
      const input = document.createElement('input');
      input.value = value;
      input.maxLength = 4096;
      input.spellcheck = false;
      input.placeholder = definition.examples[index];
      input.dataset.argument = String(index);
      input.oninput = () => {
        drafts[current][index] = input.value;
        expression.value = buildFunction(
          current,
          drafts[current],
          context.language,
        );
        preview();
      };
      label.append(input);
      return label;
    }),
  );
}
function list() {
  const search = query<HTMLInputElement>('#search')
    .value.trim()
    .toLocaleLowerCase();
  const matches = (Object.keys(functions) as FunctionName[]).filter(name =>
    [name, ...functions[name].ru, ...functions[name].en]
      .join(' ')
      .toLocaleLowerCase()
      .includes(search),
  );
  query('#functions').replaceChildren(
    ...matches.map(name => {
      const button = document.createElement('button');
      button.textContent = functions[name][context.language][0];
      button.dataset.function = name;
      button.setAttribute('aria-pressed', String(name === current));
      button.onclick = () => {
        current = name;
        expression.value = buildFunction(
          current,
          drafts[current],
          context.language,
        );
        fields();
        list();
        preview();
        query<HTMLInputElement>('[data-argument="0"]').focus();
      };
      return button;
    }),
  );
  if (!matches.length)
    query('#functions').textContent = text[context.language][6];
}
expression.oninput = () => {
  const parsed = readFunction(expression.value, context.language);
  if (parsed && parsed.args.length <= 3) {
    current = parsed.name;
    drafts[current] = [0, 1, 2].map(index => parsed.args[index] ?? '');
    fields();
    list();
  }
  preview();
};
window.addEventListener('message', event => {
  if (
    initialized ||
    event.source !== window.opener ||
    event.origin !== location.origin ||
    event.data?.type !== 'init'
  )
    return;
  initialized = true;
  context = event.data.context as WizardContext;
  document.documentElement.lang = context.language;
  const labels = text[context.language];
  document.title = labels[0];
  ['heading', 'search-label', 'formula-label', 'cancel', 'insert'].forEach(
    (id, i) => (query('#' + id).textContent = labels[i]),
  );
  query('#target').textContent = `${context.sheet}, ${context.address}`;
  query('#help').textContent = labels[7];
  for (const sheet of context.sheets) book.addSheet(sheet);
  book.setCells(context.cells);
  const parsed = readFunction(context.formula, context.language);
  if (parsed && parsed.args.length <= 3) {
    current = parsed.name;
    drafts[current] = [0, 1, 2].map(i => parsed.args[i] ?? '');
  }
  expression.value = context.formula.startsWith('=')
    ? context.formula
    : buildFunction(current, drafts[current], context.language);
  fields();
  list();
  preview();
  query('main').removeAttribute('inert');
  query('#search').focus();
});
query('#search').oninput = list;
query('#cancel').onclick = () => window.close();
insert.onclick = () => {
  if (!insert.disabled)
    window.opener?.postMessage(
      {type: 'apply', formula: expression.value},
      location.origin,
    );
};
document.addEventListener('keydown', event => {
  if (event.isComposing) return;
  if (event.key === 'Escape') window.close();
  if (event.key === 'Enter' && event.target === query('#search')) {
    event.preventDefault();
    document.querySelector<HTMLButtonElement>('#functions button')?.click();
  } else if (
    event.key === 'Enter' &&
    event.target instanceof HTMLInputElement
  ) {
    event.preventDefault();
    insert.click();
  }
});
window.opener?.postMessage({type: 'ready'}, location.origin);
