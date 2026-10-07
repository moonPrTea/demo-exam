const {app, dialog, BrowserWindow} = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {setup, createWindow} = require('../build/electron/main.cjs');

async function run() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'forma-desktop-test-'));
  await fs.mkdir(path.join(dir, 'profile', 'Shared Dictionary', 'cache'), {
    recursive: true,
  });
  app.setPath('userData', path.join(dir, 'profile'));
  await app.whenReady();
  await setup();
  const window = createWindow();
  window.webContents.setBackgroundThrottling(false);
  const errors = [];
  window.webContents.on('console-message', event => {
    if (event.level === 'error') {
      errors.push(event.message);
      console.error('Renderer:', event.message);
    }
  });
  await new Promise(resolve =>
    window.webContents.once('did-finish-load', resolve),
  );
  const evaluate = async source => {
    try {
      return await window.webContents.executeJavaScript(source);
    } catch (error) {
      throw new Error(
        `Evaluation failed: ${source}\n${error.message}\nRenderer errors: ${errors.join('; ')}`,
      );
    }
  };
  const click = selector =>
    evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const text = selector =>
    evaluate(
      `document.querySelector(${JSON.stringify(selector)}).textContent.replace(/\\s+/g, ' ').trim()`,
    );
  const capture = async name => {
    await evaluate(
      'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
    );
    await new Promise(resolve => setTimeout(resolve, 200));
    await fs.writeFile(
      path.join(dir, `${name}.png`),
      (await window.webContents.capturePage()).toPNG(),
    );
  };

  assert.match(await text('h1'), /От данных/);
  assert.match(await text('.wordmark'), /formatted/);
  assert.match(await evaluate('document.title'), /^formatted/);
  assert.equal(await text('h1'), 'От данных - к пониманию');
  assert.equal(
    await evaluate(
      '[...document.querySelectorAll(".page-heading p, .sidebar-note p, .main-footer span")].some(el => el.textContent.trim().endsWith("."))',
    ),
    false,
  );
  assert.equal(await evaluate('typeof require'), 'undefined');
  assert.equal(
    await evaluate('typeof window.desktop.exportDataset'),
    'function',
  );
  assert.equal(
    await evaluate('getComputedStyle(document.documentElement).colorScheme'),
    'light',
  );
  assert.equal(
    await evaluate(
      'getComputedStyle(document.querySelector(".hero-card")).backgroundImage',
    ),
    'none',
  );
  assert.equal(await evaluate('document.querySelector(".orbital")'), null);
  await capture('home');

  await click('[data-view="quiz"]');
  await click('[data-select-name="topic"]');
  assert.equal(
    await evaluate('document.querySelectorAll(".select-menu").length'),
    1,
  );
  await evaluate(
    'document.querySelector("[data-select-name=topic]").dispatchEvent(new KeyboardEvent("keydown", {key:"Escape", bubbles:true}))',
  );
  assert.equal(
    await evaluate('document.querySelectorAll(".select-menu").length'),
    0,
  );
  await click('[data-select-name="topic"]');
  await evaluate(
    '[...document.querySelectorAll(".select-option")].find(el => el.textContent.startsWith("Формулы Calc")).click()',
  );
  await evaluate('document.querySelector("#quiz-form").requestSubmit()');
  assert.equal(
    await evaluate('JSON.parse(localStorage.getItem("forma.v1")).quiz.topic'),
    'Формулы Calc',
  );
  assert.equal(
    await evaluate(
      'new Set(JSON.parse(localStorage.getItem("forma.v1")).quiz.questions.map(q => q.skill)).size',
    ),
    4,
  );
  await capture('quiz');
  assert.equal(
    await evaluate(
      'getComputedStyle(document.querySelector(".answer")).borderTopWidth',
    ),
    '0px',
  );
  assert.equal(
    await evaluate(
      'getComputedStyle(document.querySelector(".answer")).backgroundColor',
    ),
    'rgb(241, 244, 249)',
  );
  window.setSize(900, 800);
  await capture('quiz-formulas-900');
  await click('[data-action="hint"]');
  assert.ok((await text('.hint-box')).length > 20);
  assert.equal(await evaluate('document.querySelector(".feedback")'), null);
  for (let i = 0; i < 8; i++) {
    assert.ok(
      await evaluate('document.documentElement.scrollWidth <= innerWidth'),
      'Formula round fits the window',
    );
    assert.ok(
      await evaluate(
        'document.querySelector(".quiz-card h2").scrollWidth <= document.querySelector(".quiz-card h2").clientWidth',
      ),
      'Long formula wraps within the question',
    );
    // Correct choices are read from local test state only, never rendered before answering.
    const choice = await evaluate(
      'JSON.parse(localStorage.getItem("forma.v1")).quiz.questions[' +
        i +
        '].correct',
    );
    await click(`[data-choice="${choice}"]`);
    assert.match(await text('.feedback'), /Верно/);
    if (i === 0) await capture('quiz-formula-explanation');
    await click('[data-action="next-question"]');
  }
  assert.match(await text('h1'), /Блиц завершён/);
  window.setSize(1440, 960);
  assert.equal(
    await evaluate(
      'JSON.parse(localStorage.getItem("forma.v1")).quizHistory.length',
    ),
    1,
  );
  await click('[data-view="generator"]');
  await click('.number-field [data-step="1"]');
  assert.equal(
    await evaluate('document.querySelector("[name=size]").value'),
    '61',
  );
  await click('.number-field [data-step="-1"]');
  assert.equal(
    await evaluate('document.querySelector("[name=size]").value'),
    '60',
  );
  for (const [value, direction] of [
    [20, -1],
    [500, 1],
  ]) {
    await evaluate(
      `{ const input = document.querySelector('[name=size]'); input.value = ${value}; input.dispatchEvent(new Event('input', {bubbles:true})); }`,
    );
    assert.equal(
      await evaluate(
        `document.querySelector('.number-field [data-step="${direction}"]').disabled`,
      ),
      true,
    );
    await click(`.number-field [data-step="${direction}"]`);
    assert.equal(
      await evaluate('document.querySelector("[name=size]").value'),
      String(value),
    );
  }
  await evaluate(
    '{ const input = document.querySelector("[name=size]"); input.value = ""; input.dispatchEvent(new Event("input", {bubbles:true})); }',
  );
  await click('.number-field [data-step="1"]');
  assert.equal(
    await evaluate('document.querySelector("[name=size]").value'),
    '20',
  );
  await evaluate(
    'document.querySelector("[name=domain]").value = "library"; document.querySelector("[name=size]").value = "80"; document.querySelector("#generator-form").requestSubmit()',
  );
  assert.match(await text('.dataset-summary'), /Библиотека/);
  assert.equal(
    await evaluate(
      'document.querySelectorAll("[data-action=csv-source]").length',
    ),
    3,
  );
  assert.match(await text('.dataset-title'), /24 строк/);
  await click('[data-action="csv-source"][data-source="1"]');
  assert.match(await text('.data-table thead'), /user_code/);
  assert.match(await text('.dataset-title'), /users.csv/);
  await click('[data-action="csv-source"][data-source="2"]');
  assert.match(await text('.dataset-title'), /80 строк/);
  const firstVariant = await evaluate(
    'JSON.parse(localStorage.getItem("forma.v1")).config',
  );
  const firstConditions = await evaluate(
    '[...document.querySelectorAll(".task-line p")].map(el => el.textContent)',
  );
  await evaluate('document.querySelector("#generator-form").requestSubmit()');
  assert.notEqual(
    await evaluate('JSON.parse(localStorage.getItem("forma.v1")).config.seed'),
    firstVariant.seed,
  );
  const nextConditions = await evaluate(
    '[...document.querySelectorAll(".task-line p")].map(el => el.textContent)',
  );
  nextConditions.forEach((text, index) =>
    assert.notEqual(text, firstConditions[index]),
  );
  await evaluate(
    `document.querySelector('[name=seed]').value = ${JSON.stringify(firstVariant.seed)}`,
  );
  await click('[data-action="open-variant"]');
  assert.deepEqual(
    await evaluate(
      '[...document.querySelectorAll(".task-line p")].map(el => el.textContent)',
    ),
    firstConditions,
  );
  await evaluate(
    '{ const domain = document.querySelector("[name=domain]"); domain.value="courses"; domain.dispatchEvent(new Event("change", {bubbles:true})); }',
  );
  assert.match(await text('.dataset-summary'), /Учебный центр/);
  assert.match(await text('.data-table thead'), /room_code/);
  assert.match(await text('.dataset-title'), /cohorts.csv/);
  await click('[data-action="csv-source"][data-source="2"]');
  assert.match(await text('.data-table thead'), /enrollment_id/);
  assert.doesNotMatch(await text('.data-table thead'), /loan_id/);
  assert.match(await text('.rules-panel'), /слушател/);
  await evaluate(
    '{ const domain = document.querySelector("[name=domain]"); domain.value="library"; domain.dispatchEvent(new Event("change", {bubbles:true})); }',
  );
  assert.match(await text('.dataset-summary'), /Библиотека/);
  assert.match(await text('.dataset-title'), /catalog.csv/);
  await click('[data-action="csv-source"][data-source="2"]');
  assert.match(await text('.data-table thead'), /loan_id/);
  assert.equal(
    await evaluate(
      'getComputedStyle(document.querySelector("[name=domain]")).outlineStyle',
    ),
    'none',
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".wordmark img").getAttribute("src")',
    ),
    'assets/forma.svg',
  );
  await click('[data-select-name="domain"]');
  assert.equal(
    await evaluate(
      'document.querySelector("[data-select-name=domain]").getAttribute("aria-expanded")',
    ),
    'true',
  );
  assert.equal(
    await evaluate(
      'getComputedStyle(document.querySelector("[data-select-name=domain]")).outlineStyle',
    ),
    'none',
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".select-option[aria-selected=true]").textContent',
    ),
    'Библиотека✓',
  );
  await capture('dropdown-open');
  await evaluate(
    '[...document.querySelectorAll(".select-option")].find(el => el.textContent.startsWith("Учебный центр")).click()',
  );
  assert.match(await text('.dataset-summary'), /Учебный центр/);
  assert.equal(
    await evaluate('document.querySelectorAll(".select-menu").length'),
    0,
  );
  await evaluate(
    '{ const trigger = document.querySelector("[data-select-name=domain]"); for (const key of ["ArrowDown", "Home", "ArrowDown", "Enter"]) trigger.dispatchEvent(new KeyboardEvent("keydown", {key, bubbles:true})); }',
  );
  assert.match(await text('.dataset-summary'), /Библиотека/);
  assert.equal(
    await evaluate('document.activeElement.dataset.selectName'),
    'domain',
  );
  await click('[data-select-name="difficulty"]');
  await evaluate(
    'document.querySelector("h1").dispatchEvent(new PointerEvent("pointerdown", {bubbles:true}))',
  );
  assert.equal(
    await evaluate('document.querySelectorAll(".select-menu").length'),
    0,
  );
  await click('[data-select-name="delimiter"]');
  await evaluate(
    '{ const trigger = document.querySelector("[data-select-name=delimiter]"); trigger.dispatchEvent(new KeyboardEvent("keydown", {key:"Tab", bubbles:true})); }',
  );
  assert.equal(
    await evaluate('document.querySelectorAll(".select-menu").length'),
    0,
  );
  assert.equal(
    await evaluate(
      'new FormData(document.querySelector("#generator-form")).get("domain")',
    ),
    'library',
  );
  assert.equal(
    await evaluate(
      'document.querySelectorAll(".data-table tbody .row-number").length',
    ),
    10,
  );
  assert.equal(await evaluate('/[—·]/.test(document.body.innerText)'), false);
  await click('[data-action="csv-source"][data-source="2"]');
  assert.match(await text('.table-foot'), /Строки 1-10 из 80/);
  await evaluate(
    'document.querySelector("[name=seed]").value = "UNSAVED-DRAFT"',
  );
  await click('[data-action="csv-next"]');
  assert.match(await text('.table-foot'), /Строки 11-20 из 80/);
  assert.equal(
    await evaluate('document.querySelector("[name=seed]").value'),
    'UNSAVED-DRAFT',
  );
  assert.equal(await text('.data-table tbody .row-number'), '11');
  for (let i = 0; i < 6; i++) await click('[data-action="csv-next"]');
  assert.match(await text('.table-foot'), /Строки 71-80 из 80/);
  assert.equal(
    await evaluate('document.querySelector("[data-action=csv-next]").disabled'),
    true,
  );
  for (let i = 0; i < 7; i++) await click('[data-action="csv-prev"]');
  assert.equal(
    await evaluate('document.querySelector("[data-action=csv-prev]").disabled'),
    true,
  );
  await evaluate(
    'document.querySelector("[name=seed]").value = JSON.parse(localStorage.getItem("forma.v1")).config.seed',
  );
  assert.equal(
    await evaluate(
      'getComputedStyle(document.querySelector(".data-table th")).position',
    ),
    'sticky',
  );
  assert.equal(
    await evaluate(
      'getComputedStyle(document.querySelector(".dataset-panel")).backgroundColor',
    ),
    'rgb(255, 255, 255)',
  );
  await capture('generator');
  for (const [width, height] of [
    [1280, 800],
    [1000, 720],
    [900, 700],
  ]) {
    window.setSize(width, height);
    await capture(`generator-${width}`);
    assert.ok(
      await evaluate('document.documentElement.scrollWidth <= innerWidth'),
      `No page overflow at ${width}px`,
    );
    assert.ok(
      await evaluate(
        'document.querySelector("#generator-form button[type=submit]").getBoundingClientRect().bottom < innerHeight',
      ),
      `Generate button visible at ${width}px`,
    );
    const fieldLayout = await evaluate(
      'Object.fromEntries(["domain", "size", "difficulty", "seed", "delimiter"].map(name => { const r = document.querySelector(`[data-select-name="${name}"], input[name="${name}"]`).getBoundingClientRect(); return [name, {top:r.top, height:r.height}]; }))',
    );
    assert.equal(
      fieldLayout.domain.top,
      fieldLayout.size.top,
      `First row fields align at ${width}px`,
    );
    assert.ok(
      Object.values(fieldLayout).every(r => r.height === 44),
      `Inputs share a 44px height at ${width}px`,
    );
  }
  window.setSize(1440, 960);
  await evaluate(
    'document.querySelector(".dataset-panel").scrollIntoView({block:"start"})',
  );
  await capture('csv-preview');
  await evaluate('window.scrollTo(0, 0)');

  // Exercise the real isolated IPC exporter with a controlled native directory chooser.
  dialog.showOpenDialog = async () => ({canceled: false, filePaths: [dir]});
  const result = await evaluate(
    'window.desktop.exportDataset(JSON.parse(localStorage.getItem("forma.v1")).config, ";")',
  );
  const exported = await fs.readFile(
    path.join(result.directory, 'loans.csv'),
    'utf8',
  );
  assert.match(exported, /loan_id/);
  assert.equal(result.count, 5);
  assert.deepEqual((await fs.readdir(result.directory)).sort(), [
    'assignment.md',
    'catalog.csv',
    'loans.csv',
    'users.csv',
    'variant.json',
  ]);
  assert.match(
    await fs.readFile(path.join(result.directory, 'assignment.md'), 'utf8'),
    /Выборки/,
  );
  await click('[data-view="practice"]');
  await click('[name=minutes] ~ [data-step="1"]');
  assert.equal(
    await evaluate('document.querySelector("[name=minutes]").value'),
    '46',
  );
  await click('[name=minutes] ~ [data-step="-1"]');
  await capture('practice-setup');
  await evaluate('document.querySelector("#practice-form").requestSubmit()');
  assert.match(await text('h1'), /Библиотека/);
  await capture('practice');
  await evaluate(
    'const input = document.querySelector("[data-answer=filter]"); input.value = "123"; input.dispatchEvent(new Event("input", {bubbles:true})); document.querySelector("[data-check]").click()',
  );
  let reload = new Promise(resolve =>
    window.webContents.once('did-finish-load', resolve),
  );
  await evaluate('location.reload()');
  await reload;
  assert.equal(
    await evaluate('document.querySelector("[data-answer=filter]").value'),
    '123',
  );
  assert.equal(
    await evaluate('document.querySelector("[data-check]").checked'),
    true,
  );
  assert.ok(
    await evaluate(
      'document.querySelector("[data-clock]").textContent !== "45:00" || JSON.parse(localStorage.getItem("forma.v1")).session.startedAt > Date.now()-1000',
    ),
  );
  await click('[data-view="quiz"]');
  assert.match(await text('h1'), /Библиотека/);
  await click('[data-action="finish"]');
  await click('[data-action="confirm-finish"]');
  assert.match(await text('h1'), /Попытка завершена/);
  assert.equal(
    await evaluate(
      'JSON.parse(localStorage.getItem("forma.v1")).history.length',
    ),
    1,
  );
  await click('[data-action="new-session"]');
  await evaluate('document.querySelector("#practice-form").requestSubmit()');
  reload = new Promise(resolve =>
    window.webContents.once('did-finish-load', resolve),
  );
  await evaluate(
    'const state = JSON.parse(localStorage.getItem("forma.v1")); state.session.deadline = Date.now()-1; state.session.startedAt = state.session.deadline-45*60000; localStorage.setItem("forma.v1", JSON.stringify(state)); location.reload()',
  );
  await reload;
  assert.match(await text('h1'), /Время вышло/);
  await click('[data-view="history"]');
  assert.match(await text('h1'), /Твой прогресс/);
  assert.equal(
    await evaluate(
      'getComputedStyle(document.querySelector(".achievement")).borderTopWidth',
    ),
    '0px',
  );
  assert.equal(
    await evaluate('document.querySelectorAll(".achievement progress").length'),
    4,
  );
  assert.equal(
    await evaluate('document.querySelector(".achievement progress").value'),
    1,
  );
  await capture('history');
  assert.deepEqual(
    await evaluate(`(() => {
      const link = document.querySelector('.history-link');
      const style = getComputedStyle(link);
      return [style.backgroundColor, style.padding,
        link.getBoundingClientRect().left === link.nextElementSibling.getBoundingClientRect().left];
    })()`),
    ['rgba(0, 0, 0, 0)', '0px', true],
  );
  await evaluate("document.querySelector('.history-link').focus()");
  await capture('history-link-focus');
  await click('.history-link');
  assert.match(await text('h1'), /Время вышло|Попытка завершена/);
  const preview = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  await preview.loadFile(path.resolve(__dirname, '../src/index.html'));
  assert.match(
    await preview.webContents.executeJavaScript(
      'document.querySelector("h1").textContent',
    ),
    /От данных/,
  );
  assert.equal(
    await preview.webContents.executeJavaScript('typeof window.desktop'),
    'undefined',
  );
  await preview.webContents.executeJavaScript(
    'document.querySelector("[data-view=generator]").click()',
  );
  assert.deepEqual(
    await preview.webContents.executeJavaScript(
      '[...document.querySelectorAll("[data-file]")].map(button => button.dataset.file)',
    ),
    ['catalog.csv', 'users.csv', 'orders.csv', 'assignment.md', 'variant.json'],
  );
  preview.destroy();
  assert.deepEqual(errors, []);
  console.log(
    `Desktop smoke test passed. Screenshots and test exports: ${dir}`,
  );
  app.quit();
}
run().catch(error => {
  console.error(error);
  app.exit(1);
});
