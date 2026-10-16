import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildFunction, readFunction} from '../build/src/sheets/wizard-model.js';

test('wizard builds localized functions and omits only the optional INDEX argument', () => {
  assert.equal(
    buildFunction('INDEX', [' A1:B3 ', '2', ''], 'ru'),
    '=ИНДЕКС(A1:B3;2)',
  );
  assert.equal(
    buildFunction('INDEX', ['A1:B3', '2', '1'], 'en'),
    '=INDEX(A1:B3;2;1)',
  );
  assert.equal(
    buildFunction('MATCH', ['C2', 'A1:A3', '0'], 'ru'),
    '=ПОИСКПОЗ(C2;A1:A3;0)',
  );
});

test('wizard reads nested functions without splitting text or quoted sheet names', () => {
  const parsed = readFunction(
    '=ИНДЕКС(\'A;B\'.A1:A3;ПОИСКПОЗ("x;y";C1:C3;0))',
    'en',
  );
  assert.equal(parsed.name, 'INDEX');
  assert.deepEqual(parsed.args, ["'A;B'.A1:A3", 'MATCH("x;y";C1:C3;0)']);
  for (const source of ['=1+', '=SUM(A1:A2)', 'text', '=1+2'])
    assert.equal(readFunction(source, 'ru'), null);
});
