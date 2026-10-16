import {type Workbook} from '../spreadsheet/index.js';
import {type WizardContext} from './wizard-model.js';

export function functionDialog(
  book: Workbook,
  context: () => Omit<WizardContext, 'cells' | 'sheets'>,
  apply: (formula: string) => boolean,
) {
  let child: Window | null = null;
  let snapshot: WizardContext;
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || !child || event.source !== child)
      return;
    if (event.data?.type === 'ready')
      child.postMessage({type: 'init', context: snapshot}, location.origin);
    if (
      event.data?.type === 'apply' &&
      typeof event.data.formula === 'string' &&
      event.data.formula.startsWith('=') &&
      event.data.formula.length <= 4096
    ) {
      if (apply(event.data.formula)) child.close();
    }
  });
  return () => {
    if (child && !child.closed) {
      child.focus();
      return;
    }
    snapshot = {...context(), sheets: book.getSheetNames(), cells: []};
    for (const sheet of snapshot.sheets)
      for (let row = 1; row <= 100; row++)
        for (let col = 0; col < 12; col++) {
          const address = `${String.fromCharCode(65 + col)}${row}`;
          const input = book.getCell(sheet, address);
          if (input !== null) snapshot.cells.push({sheet, address, input});
        }
    child = window.open('wizard.html', 'function-wizard');
  };
}
