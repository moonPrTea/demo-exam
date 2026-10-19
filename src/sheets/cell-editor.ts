import {formulaHint} from './formula-hints.js';
import {type FormulaLanguage} from '../spreadsheet/index.js';

export function cellEditor(
  formula: HTMLInputElement,
  cell: () => HTMLElement,
  language: () => FormulaLanguage,
  changed: () => void,
  apply: (tab: number) => void,
  cancel: () => void,
) {
  const input = document.createElement('input');
  input.id = 'cell-editor';
  input.maxLength = formula.maxLength;
  input.spellcheck = false;
  input.autocomplete = 'off';
  input.setAttribute(
    'aria-label',
    language() === 'ru' ? 'Редактирование ячейки' : 'Edit cell',
  );
  const popup = document.createElement('aside');
  popup.id = 'formula-hint';
  input.setAttribute('aria-describedby', popup.id);
  formula.setAttribute('aria-describedby', popup.id);
  popup.hidden = true;
  document.body.append(popup);
  let source = formula;
  let composing = false;
  let hint: ReturnType<typeof formulaHint> = null;
  const hide = () => {
    popup.hidden = true;
  };
  const position = () => {
    const rect = source.getBoundingClientRect();
    popup.style.left =
      Math.max(8, Math.min(rect.left, innerWidth - popup.offsetWidth - 8)) +
      'px';
    popup.style.top =
      Math.max(
        8,
        rect.bottom + popup.offsetHeight + 8 <= innerHeight
          ? rect.bottom + 4
          : rect.top - popup.offsetHeight - 4,
      ) + 'px';
  };
  const accept = () => {
    if (!hint?.completion) return;
    const {start, end, text} = hint.completion;
    source.setRangeText(text, start, end, 'end');
    source.focus();
    sync(source);
  };
  const suggest = () => {
    hint = composing
      ? null
      : formulaHint(
          source.value,
          source.selectionStart ?? source.value.length,
          language(),
        );
    popup.replaceChildren();
    popup.hidden = !hint;
    if (!hint) return;
    const title = document.createElement(hint.completion ? 'button' : 'strong');
    title.textContent = hint.label;
    if (title instanceof HTMLButtonElement) {
      title.type = 'button';
      title.textContent += '   Tab';
      title.onmousedown = event => event.preventDefault();
      title.onclick = accept;
    }
    popup.append(title, document.createElement('br'));
    hint.args.forEach((arg, index) => {
      const part = document.createElement(
        index === hint!.argument ? 'b' : 'span',
      );
      part.textContent = (index ? '; ' : '(') + arg;
      popup.append(part);
    });
    popup.append(')');
    const description = document.createElement('p');
    description.textContent = hint.description;
    popup.append(description);
    position();
  };
  function sync(from: HTMLInputElement) {
    source = from;
    if (from === formula) {
      cell().append(input);
      input.value = formula.value;
    } else formula.value = input.value;
    changed();
    suggest();
  }
  for (const field of [input, formula]) {
    field.addEventListener('input', () => sync(field));
    field.addEventListener('focus', () => {
      source = field;
      suggest();
    });
    field.addEventListener('keyup', () => {
      source = field;
      suggest();
    });
    field.addEventListener('click', event => {
      event.stopPropagation();
      source = field;
      suggest();
    });
    field.addEventListener('compositionstart', () => {
      composing = true;
      hide();
    });
    field.addEventListener('compositionend', () => {
      composing = false;
      sync(field);
    });
    field.addEventListener('blur', hide);
    field.addEventListener('keydown', event => {
      if (event.isComposing || composing) {
        event.stopPropagation();
        return;
      }
      if (event.key === 'Tab' && hint?.completion) {
        event.preventDefault();
        event.stopPropagation();
        accept();
        return;
      }
      if (field === formula) return;
      event.stopPropagation();
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        apply(event.key === 'Tab' ? (event.shiftKey ? -1 : 1) : 0);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
      }
    });
    field.addEventListener('paste', event => {
      event.stopPropagation();
      if (/[\t\r\n]/.test(event.clipboardData?.getData('text/plain') ?? ''))
        event.preventDefault();
    });
  }
  input.addEventListener('dblclick', event => event.stopPropagation());
  cell().closest('#grid-scroll')?.addEventListener('scroll', hide);
  window.addEventListener('resize', hide);
  return {
    preview() {
      cell().append(input);
      input.value = formula.value;
    },
    start(replacement?: string) {
      cell().append(input);
      input.setAttribute(
        'aria-label',
        language() === 'ru' ? 'Редактирование ячейки' : 'Edit cell',
      );
      input.value = replacement ?? formula.value;
      formula.value = input.value;
      source = input;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      if (replacement !== undefined) changed();
      suggest();
    },
    reset() {
      input.remove();
      hide();
      hint = null;
    },
  };
}
