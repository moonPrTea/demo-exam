import {html} from './dom.js';

export function environmentView() {
  return html`<section class="panel environment-panel">
    <h2>Подготовка к практике</h2>
    <p>
      Блиц, генератор и проверка CSV работают без дополнительных программ. Для
      практики в Calc нужны LibreOffice и Python 3.9+, для собственной ИИ-темы
      нужна Ollama
    </p>
    ${window.desktop ? html`<div class="actions"><button class="button secondary" data-action="check-environment">Проверить окружение</button><button class="button ghost" data-action="setup-page" data-tool="calc">Скачать LibreOffice</button><button class="button ghost" data-action="setup-page" data-tool="python">Скачать Python</button><button class="button ghost" data-action="setup-page" data-tool="ollama">Скачать Ollama</button></div>` : '<p>Запусти desktop-приложение для проверки программ</p>'}
    <p class="environment-status" role="status" aria-live="polite"></p>
    <p class="small-note">
      Установка программ выполняется с официальных сайтов. Приложение не
      запрашивает пароль администратора и не запускает скачанные установщики
    </p>
  </section>`;
}
