import {databaseSteps, readDatabaseProgress} from './core/database-lesson.js';
import {query} from './dom.js';

const key = 'formatted.database.v1';
const escape = (text: string) =>
  text.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

export function databaseView() {
  return `<section id="database-lesson" class="database-lesson">
    <div class="page-heading"><div><h1>Базы данных</h1><p>Модуль 02. Пишем SQL и проверяем его в PostgreSQL через pgAdmin</p></div></div>
    <p class="notice">Начальный практикум на двух таблицах. Твои 12 таблиц из первого модуля остаются отдельным заданием. SQL здесь не выполняется и автоматически не оценивается</p>
    <div class="lesson-layout"><nav class="panel lesson-nav" id="database-steps" aria-label="Этапы PostgreSQL"></nav>
      <section class="panel database-content" id="database-content"></section></div>
    <p id="database-storage" role="status"></p>
  </section>`;
}
export function mountDatabase() {
  let progress = readDatabaseProgress(null);
  let readable = true;
  try {
    progress = readDatabaseProgress(
      JSON.parse(localStorage.getItem(key) ?? 'null'),
    );
  } catch {
    readable = false;
  }
  const save = () => {
    try {
      localStorage.setItem(key, JSON.stringify(progress));
      query('#database-storage').textContent =
        'Черновики сохранены на устройстве';
    } catch {
      query('#database-storage').textContent =
        'Не удалось сохранить черновики. Скачай SQL до закрытия окна';
    }
  };
  const render = () => {
    const i = progress.step,
      step = databaseSteps[i];
    query('#database-steps').innerHTML = databaseSteps
      .map(
        (s, n) =>
          `<button data-db-step="${n}" aria-current="${n === i ? 'step' : 'false'}" class="lesson-step ${n === i ? 'selected' : ''}"><span>${String(n + 1).padStart(2, '0')}</span>${escape(s.title)}</button>`,
      )
      .join('');
    const answer = progress.answers[i];
    query('#database-content').innerHTML =
      `<span class="tag">Шаг ${i + 1} из ${databaseSteps.length}</span>
      <h2 id="database-title" tabindex="-1">${escape(step.title)}</h2><p>${escape(step.goal)}</p>
      <ol>${step.tasks.map(text => `<li>${escape(text)}</li>`).join('')}</ol>
      <details><summary>Подсказка</summary><p>${escape(step.hint)}</p></details>
      <label for="database-sql">Твой SQL</label><textarea id="database-sql" rows="9" maxlength="50000" spellcheck="false" placeholder="Напиши команды самостоятельно">${escape(progress.drafts[i])}</textarea>
      <button type="button" class="button secondary" id="database-download">Скачать SQL этого шага</button>
      <fieldset><legend>${escape(step.question)}</legend>${step.answers.map((text, n) => `<label><input type="radio" name="db-answer" value="${n}" ${answer === n ? 'checked' : ''}>${escape(text)}</label>`).join('')}</fieldset>
      <p id="database-feedback" role="status">${answer === null ? 'Проверяется понимание, не выполнение SQL' : `${answer === step.correct ? 'Верно' : 'Попробуй ещё раз'}. ${escape(step.explanation)}`}</p>
      <p class="muted">Справочник: ${escape(step.source)}</p>
      <div class="database-navigation"><button class="button secondary" id="database-prev" ${i === 0 ? 'disabled' : ''}>Назад</button><span>Ответов верно: ${progress.answers.filter((a, n) => a === databaseSteps[n].correct).length} из ${databaseSteps.length}</span><button class="button primary" id="database-next" ${i === databaseSteps.length - 1 ? 'disabled' : ''}>Далее</button></div>`;
    query<HTMLTextAreaElement>('#database-sql').oninput = event => {
      progress.drafts[i] = (event.target as HTMLTextAreaElement).value;
      save();
    };
    query('#database-content')
      .querySelectorAll<HTMLInputElement>('[name=db-answer]')
      .forEach(input => {
        input.onchange = () => {
          progress.answers[i] = Number(input.value);
          save();
          render();
          query<HTMLInputElement>(
            `[name=db-answer][value="${input.value}"]`,
          ).focus();
        };
      });
    const move = (index: number) => {
      progress.step = index;
      save();
      render();
      query('#database-title').focus({preventScroll: true});
      query('#database-title').scrollIntoView({block: 'start'});
    };
    query('#database-steps')
      .querySelectorAll<HTMLButtonElement>('[data-db-step]')
      .forEach(button => {
        button.onclick = () => move(Number(button.dataset.dbStep));
      });
    query('#database-prev').onclick = () => move(i - 1);
    query('#database-next').onclick = () => move(i + 1);
    query('#database-download').onclick = () => {
      const url = URL.createObjectURL(
        new Blob([progress.drafts[i]], {type: 'text/plain;charset=utf-8'}),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `module-02-step-${i + 1}.sql`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  };
  render();
  if (!readable)
    query('#database-storage').textContent =
      'Не удалось прочитать прошлые черновики';
}
