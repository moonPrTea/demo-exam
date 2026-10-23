import {app} from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import type {PackageReference, PackageResult} from '../src/studio/model.js';
import type {StudioService} from './studio-service.cjs';

const cacheRoot = () => path.join(app.getPath('userData'), 'studio-nuget');
const folder = (p: PackageReference) =>
  path.join(cacheRoot(), p.id.toLowerCase(), p.version.toLowerCase());
async function validate(value: unknown) {
  return (await import('../src/studio/model.js')).readPackages(value);
}
async function download(url: string, limit: number) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== 'https:' ||
    !(parsed.hostname === 'nuget.org' || parsed.hostname.endsWith('.nuget.org'))
  )
    throw new Error('Недопустимый источник NuGet');
  const response = await globalThis.fetch(url, {
    signal: AbortSignal.timeout(30000),
    redirect: 'error',
  });
  if (!response.ok || !response.body)
    throw new Error(`NuGet: HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > limit)
    throw new Error('Слишком большой ответ NuGet');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > limit) throw new Error('Слишком большой ответ NuGet');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export async function searchPackages(query: string): Promise<PackageResult[]> {
  if (typeof query !== 'string' || query.length > 100)
    throw new Error('Слишком длинный запрос');
  const index = JSON.parse(
    (await download('https://api.nuget.org/v3/index.json', 100000)).toString(),
  );
  const resource = index.resources.find(
    (r: Record<string, string>) =>
      r['@type'] === 'SearchQueryService/3.5.0' ||
      r['@type'] === 'SearchQueryService',
  );
  if (!resource) throw new Error('Поиск NuGet недоступен');
  const url = new URL(resource['@id']);
  url.search = new URLSearchParams({
    q: query,
    take: '12',
    prerelease: 'false',
  }).toString();
  const result = JSON.parse((await download(url.href, 2000000)).toString());
  const packages: PackageResult[] = [];
  for (const p of result.data.slice(0, 12)) {
    const [ref] = await validate([{id: p.id, version: p.version}]);
    const versions: string[] = [];
    for (const entry of (p.versions ?? []).slice(-20).reverse()) {
      try {
        await validate([{id: ref.id, version: entry.version}]);
        versions.push(entry.version);
      } catch {
        /* Ignore nonstandard versions in search results. */
      }
    }
    packages.push({
      ...ref,
      description: String(p.description ?? '').slice(0, 350),
      authors: (Array.isArray(p.authors)
        ? p.authors.join(', ')
        : String(p.authors ?? '')
      ).slice(0, 180),
      downloads:
        Number.isSafeInteger(p.totalDownloads) && p.totalDownloads >= 0
          ? p.totalDownloads
          : 0,
      versions: [...new Set([ref.version, ...versions])],
    });
  }
  return packages;
}
export async function packageReferences(value: unknown): Promise<string[]> {
  const packages = await validate(value ?? []);
  const references: string[] = [],
    names = new Set<string>();
  for (const p of packages) {
    const directory = folder(p);
    let manifest;
    try {
      manifest = JSON.parse(
        await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'),
      );
    } catch {
      throw new Error(`Восстанови пакет ${p.id} ${p.version} в NuGet`);
    }
    if (
      manifest.id.toLowerCase() !== p.id.toLowerCase() ||
      manifest.version !== p.version ||
      !manifest.hashes ||
      Object.keys(manifest.hashes).length > 100
    )
      throw new Error('Повреждён кэш NuGet');
    for (const [name, hash] of Object.entries(manifest.hashes)) {
      if (!/^[A-Za-z0-9_.-]+\.dll$/.test(name) || names.has(name.toLowerCase()))
        throw new Error('Конфликт сборок NuGet');
      const file = path.join(directory, name);
      if (
        (await fs.stat(file)).size > 30_000_000 ||
        createHash('sha256')
          .update(await fs.readFile(file))
          .digest('hex')
          .toUpperCase() !== hash
      )
        throw new Error(`Повреждён пакет ${p.id}; установи его повторно`);
      names.add(name.toLowerCase());
      references.push(file);
    }
  }
  return references;
}
export async function installPackage(value: unknown, service: StudioService) {
  const [p] = await validate([value]);
  try {
    await packageReferences([p]);
    return;
  } catch {
    /* Restore absent or damaged cache below. */
  }
  await fs.mkdir(cacheRoot(), {recursive: true});
  const temp = await fs.mkdtemp(path.join(cacheRoot(), '.download-'));
  try {
    const id = p.id.toLowerCase(),
      version = p.version.toLowerCase();
    const bytes = await download(
      `https://api.nuget.org/v3-flatcontainer/${id}/${version}/${id}.${version}.nupkg`,
      30_000_000,
    );
    const archive = path.join(temp, 'download.nupkg'),
      destination = path.join(temp, 'checked');
    await fs.writeFile(archive, bytes);
    await service.request({
      operation: 'package-install',
      archive,
      destination,
      packageId: p.id,
      version: p.version,
    });
    await fs.mkdir(path.dirname(folder(p)), {recursive: true});
    if (await fs.stat(folder(p)).catch(() => null))
      await fs.rename(folder(p), folder(p) + '.previous-' + Date.now());
    await fs.rename(destination, folder(p));
  } finally {
    // Only this operation's temporary download directory, never project files.
    await fs.rm(temp, {recursive: true, force: true});
  }
}
