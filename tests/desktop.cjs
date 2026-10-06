const { app, dialog } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { setup, createWindow } = require('../electron/main.cjs');

async function run() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'forma-desktop-test-'));
  await fs.mkdir(path.join(dir, 'profile', 'Shared Dictionary', 'cache'), { recursive: true });
  app.setPath('userData', path.join(dir, 'profile'));
  await app.whenReady();
  await setup();
  const window = createWindow();
  const errors = [];
  window.webContents.on('console-message', event => { if (event.level === 'error') { errors.push(event.message); console.error('Renderer:', event.message); } });
  await new Promise(resolve => window.webContents.once('did-finish-load', resolve));
  const evaluate = async source => {
    try { return await window.webContents.executeJavaScript(source); }
    catch (error) { throw new Error(`Evaluation failed: ${source}\n${error.message}\nRenderer errors: ${errors.join('; ')}`); }
  };
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const text = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).textContent`);
  const capture = async name => {
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    await new Promise(resolve => setTimeout(resolve, 200));
    await fs.writeFile(path.join(dir, `${name}.png`), (await window.webContents.capturePage()).toPNG());
  };

  assert.match(await text('h1'), /От данных/);
  assert.equal(await evaluate('typeof require'), 'undefined');
  assert.equal(await evaluate('typeof window.desktop.exportDataset'), 'function');
  await capture('home');

  await click('[data-view="quiz"]');
  await evaluate('document.querySelector("#quiz-form").requestSubmit()');
  await capture('quiz');
  for (let i = 0; i < 8; i++) {
    // Correct choices are read from local test state only, never rendered before answering.
    const choice = await evaluate('JSON.parse(localStorage.getItem("forma.v1")).quiz.questions[' + i + '].correct');
    await click(`[data-choice="${choice}"]`);
    assert.match(await text('.feedback'), /Верно/);
    await click('[data-action="next-question"]');
  }
  assert.match(await text('h1'), /Блиц завершён/);
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("forma.v1")).quizHistory.length'), 1);
  await click('[data-view="generator"]');
  await evaluate('document.querySelector("[name=domain]").value = "library"; document.querySelector("[name=size]").value = "80"; document.querySelector("#generator-form").requestSubmit()');
  assert.match(await text('.dataset-summary'), /Библиотека/);
  assert.match(await text('.dataset-title'), /80 строк/);
  await capture('generator');

  // Exercise the real isolated IPC exporter with a controlled native directory chooser.
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [dir] });
  const result = await evaluate('window.desktop.exportDataset(JSON.parse(localStorage.getItem("forma.v1")).config, ";")');
  const exported = await fs.readFile(path.join(result.directory, 'source.csv'), 'utf8');
  assert.match(exported, /loan_id/);
  assert.match(await fs.readFile(path.join(result.directory, 'assignment.md'), 'utf8'), /Выборки/);
  await click('[data-view="practice"]');
  await evaluate('document.querySelector("#practice-form").requestSubmit()');
  assert.match(await text('h1'), /Библиотека/);
  await capture('practice');
  await evaluate('const input = document.querySelector("[data-answer=filter]"); input.value = "123"; input.dispatchEvent(new Event("input", {bubbles:true})); document.querySelector("[data-check]").click()');
  let reload = new Promise(resolve => window.webContents.once('did-finish-load', resolve));
  await evaluate('location.reload()');
  await reload;
  assert.equal(await evaluate('document.querySelector("[data-answer=filter]").value'), '123');
  assert.equal(await evaluate('document.querySelector("[data-check]").checked'), true);
  assert.ok(await evaluate('document.querySelector("[data-clock]").textContent !== "45:00" || JSON.parse(localStorage.getItem("forma.v1")).session.startedAt > Date.now()-1000'));
  await click('[data-view="quiz"]');
  assert.match(await text('h1'), /Библиотека/);
  await click('[data-action="finish"]');
  await click('[data-action="confirm-finish"]');
  assert.match(await text('h1'), /Попытка завершена/);
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("forma.v1")).history.length'), 1);
  await click('[data-action="new-session"]');
  await evaluate('document.querySelector("#practice-form").requestSubmit()');
  reload = new Promise(resolve => window.webContents.once('did-finish-load', resolve));
  await evaluate('const state = JSON.parse(localStorage.getItem("forma.v1")); state.session.deadline = Date.now()-1; state.session.startedAt = state.session.deadline-45*60000; localStorage.setItem("forma.v1", JSON.stringify(state)); location.reload()');
  await reload;
  assert.match(await text('h1'), /Время вышло/);
  await click('[data-view="history"]');
  assert.match(await text('h1'), /Твой прогресс/);
  await capture('history');
  assert.deepEqual(errors, []);
  console.log(`Desktop smoke test passed. Screenshots and test exports: ${dir}`);
  app.quit();
}
run().catch(error => { console.error(error); app.exit(1); });
