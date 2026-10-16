import {formatExpression, parseFormula} from '../spreadsheet/formula.js';
import {type CellChange, type FormulaLanguage} from '../spreadsheet/index.js';

export const functions = {
  INDEX: {
    ru: [
      'ИНДЕКС',
      'Возвращает значение по позиции в диапазоне',
      'Диапазон',
      'Номер строки',
      'Номер столбца (необязательно)',
    ],
    en: [
      'INDEX',
      'Returns a value at a position in a range',
      'Range',
      'Row number',
      'Column number (optional)',
    ],
    examples: ['Категории.$A$2:$A$4', 'G2', '1'],
  },
  MATCH: {
    ru: [
      'ПОИСКПОЗ',
      'Находит позицию значения, а не его ID',
      'Искомое значение',
      'Диапазон поиска',
      'Тип сопоставления',
    ],
    en: [
      'MATCH',
      'Finds the position of a value, not its ID',
      'Search value',
      'Search range',
      'Match type',
    ],
    examples: ['C2', 'Категории.$B$2:$B$4', '0'],
  },
};
export type FunctionName = keyof typeof functions;
export interface WizardContext {
  language: FormulaLanguage;
  sheet: string;
  address: string;
  formula: string;
  sheets: string[];
  cells: CellChange[];
}
export function readFunction(source: string, language: FormulaLanguage) {
  const expression = parseFormula(source);
  if (expression.kind !== 'call' || !Object.hasOwn(functions, expression.name))
    return null;
  return {
    name: expression.name as FunctionName,
    args: expression.args.map(arg => formatExpression(arg, language).slice(1)),
  };
}
export function buildFunction(
  name: FunctionName,
  args: string[],
  language: FormulaLanguage,
) {
  const parts = args.map(value => value.trim());
  if (name === 'INDEX' && !parts[2]) parts.pop();
  return `=${functions[name][language][0]}(${parts.join(';')})`;
}
