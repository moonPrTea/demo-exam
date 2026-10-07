import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('build/src');
const types: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const file = path.resolve(
        root,
        '.' +
          (url.pathname === '/'
            ? '/index.html'
            : decodeURIComponent(url.pathname)),
      );
      if (!file.startsWith(root + path.sep)) throw new Error();
      const content = await readFile(file);
      res.writeHead(200, {
        'Content-Type':
          (types[path.extname(file)] ?? 'text/plain') + '; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  })
  .listen(4173, '127.0.0.1', () =>
    console.log('formatted preview: http://127.0.0.1:4173'),
  );
