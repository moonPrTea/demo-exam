import {cp, readFile, writeFile} from 'node:fs/promises';

for (const name of ['styles.css', 'theme.css', 'assets']) {
  await cp(`src/${name}`, `build/src/${name}`, {recursive: true});
}
const html = await readFile('src/index.html', 'utf8');
await writeFile(
  'build/src/index.html',
  html.replace('../build/src/app.js', 'app.js'),
);
