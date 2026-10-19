const {app, BrowserWindow} = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {setup} = require('../build/electron/main.cjs');
const {openSheets} = require('../build/electron/sheets.cjs');

async function run() {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'formatted-editing-'),
  );
  app.setPath('userData', directory);
  await app.whenReady();
  await setup();
  openSheets();
  const window = BrowserWindow.getAllWindows()[0];
  const evaluate = code => window.webContents.executeJavaScript(code);
  const wait = async condition => {
    const deadline = Date.now() + 5000;
    while (!(await condition())) {
      assert.ok(Date.now() < deadline, 'Condition timed out');
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  };
  const click = selector =>
    evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const key = async (keyCode, modifiers = []) => {
    window.focus();
    window.webContents.sendInputEvent({type: 'keyDown', keyCode, modifiers});
    window.webContents.sendInputEvent({type: 'keyUp', keyCode, modifiers});
    await evaluate('new Promise(resolve => requestAnimationFrame(resolve))');
  };
  const type = text => window.webContents.insertText(text);
  await wait(() => evaluate('!!document.querySelector("[data-cell=A1]")'));
  await click('[data-cell="J2"]');
  await key('=');
  await type('ИНД');
  assert.equal(await evaluate('document.activeElement.id'), 'cell-editor');
  assert.equal(
    await evaluate('document.querySelector("#cell-editor").value'),
    '=ИНД',
  );
  assert.equal(
    await evaluate('document.querySelector("#formula").value'),
    '=ИНД',
  );
  assert.equal(
    await evaluate('document.querySelector("#formula-hint").hidden'),
    false,
  );
  await key('Tab');
  assert.equal(
    await evaluate('document.querySelector("#cell-editor").value'),
    '=ИНДЕКС(',
  );
  await type('Категории.A2:A4;');
  assert.equal(
    await evaluate('document.querySelector("#formula-hint b").textContent'),
    '; Номер строки',
  );
  await fs.writeFile(
    path.join(directory, 'inline-hint.png'),
    (await window.webContents.capturePage()).toPNG(),
  );
  await type('2)');
  await key('Enter');
  assert.equal(
    await evaluate('document.querySelector("[data-cell=J2]").textContent'),
    '25',
  );
  await key('F2');
  await type('+1');
  await key('Escape');
  assert.equal(
    await evaluate('document.querySelector("[data-cell=J2]").textContent'),
    '25',
  );
  await key('F2');
  await type('+1');
  await key('Enter');
  assert.equal(
    await evaluate('document.querySelector("[data-cell=J2]").textContent'),
    '26',
  );
  await click('#undo');
  assert.equal(
    await evaluate('document.querySelector("[data-cell=J2]").textContent'),
    '25',
  );
  console.log(
    '1. Inline input, bilingual completion, arguments, Enter, F2, Escape and undo',
  );
  await evaluate(
    `const f=document.querySelector('#formula'); f.focus(); f.value='=ПОИСК'; f.setSelectionRange(6,6); f.dispatchEvent(new Event('input',{bubbles:true}));`,
  );
  assert.equal(
    await evaluate('document.querySelector("#cell-editor").value'),
    '=ПОИСК',
  );
  await click('#formula-hint button');
  assert.equal(
    await evaluate('document.querySelector("#formula").value'),
    '=ПОИСКПОЗ(',
  );
  await key('Escape');
  for (const [width, zoom] of [
    [640, 1],
    [640, 2],
    [1200, 1],
  ]) {
    window.setContentSize(width, 600);
    window.webContents.setZoomFactor(zoom);
    await click('[data-cell="A3"]');
    await key('=');
    await type('INDEX(');
    await evaluate('new Promise(resolve => requestAnimationFrame(resolve))');
    assert.equal(
      await evaluate(
        `(() => { const r=document.querySelector('#formula-hint').getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth && r.bottom<=innerHeight; })()`,
      ),
      true,
    );
    await fs.writeFile(
      path.join(directory, `hint-${width}-${zoom}.png`),
      (await window.webContents.capturePage()).toPNG(),
    );
    await key('Escape');
  }
  console.log(
    '2. Formula bar synchronization, mouse completion, narrow layouts and 200% zoom',
  );
  console.log('Screenshots:', directory);
  app.exit(0);
}
setTimeout(() => app.exit(1), 60000);
run().catch(error => {
  console.error(error);
  app.exit(1);
});
