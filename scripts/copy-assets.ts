import {cp, readFile, writeFile} from 'node:fs/promises';
import {calcLesson} from '../src/core/calc-lesson.js';

for (const name of ['styles.css', 'theme.css', 'workspace.css', 'assets']) {
  await cp(`src/${name}`, `build/src/${name}`, {recursive: true});
}
await cp('desktop-tools', 'build/desktop-tools', {recursive: true});
await writeFile(
  'build/desktop-tools/calc-lesson.json',
  JSON.stringify(calcLesson),
);
const html = await readFile('src/index.html', 'utf8');
await writeFile(
  'build/src/index.html',
  html.replace('../build/src/app.js', 'app.js'),
);
