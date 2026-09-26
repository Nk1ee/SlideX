import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectDir = path.join(root, 'integrations', 'valtown', 'project');
const apply = process.argv.includes('--apply');

async function localSetting(name) {
  const direct = process.env[name]?.trim();
  if (direct) return direct;
  try {
    const raw = (await readFile(path.join(root, '.env.local', name + '.txt'), 'utf8')).trim();
    const prefix = name + '=';
    return raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  }
}

const directories = [];
const files = [];

async function walk(absoluteDir, relativeDir = '') {
  for (const entry of await readdir(absoluteDir, { withFileTypes: true })) {
    if (entry.name === '.vt' || entry.name === 'node_modules') continue;
    const relative = relativeDir ? relativeDir + '/' + entry.name : entry.name;
    const absolute = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      directories.push(relative);
      await walk(absolute, relative);
    } else if (entry.isFile()) {
      files.push({ path: relative, absolute });
    }
  }
}

await walk(projectDir);
directories.sort((left, right) => left.split('/').length - right.split('/').length || left.localeCompare(right));
files.sort((left, right) => left.path.localeCompare(right.path));

if (!apply) {
  console.log(JSON.stringify({
    mode: 'dry-run',
    projectDir,
    directoryCount: directories.length,
    fileCount: files.length,
    directories,
    files: files.map((file) => ({ path: file.path, type: file.path === 'main.ts' ? 'http' : 'file' })),
  }, null, 2));
  process.exit(0);
}

const apiKey = await localSetting('VAL_TOWN_API_KEY');
const valId = await localSetting('VAL_TOWN_VAL_ID');
if (!apiKey) throw new Error('VAL_TOWN_API_KEY is required for --apply');
if (!valId) throw new Error('VAL_TOWN_VAL_ID is required for --apply');

const baseUrl = 'https://api.val.town/v2/vals/' + encodeURIComponent(valId) + '/files';
async function api(method, filePath, body) {
  const response = await fetch(baseUrl + '?path=' + encodeURIComponent(filePath), {
    method,
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return response;
}

for (const directory of directories) {
  const response = await api('POST', directory, { type: 'directory' });
  if (response.status !== 409 && !response.ok) {
    throw new Error('Val Town directory sync failed for ' + directory + ': HTTP ' + response.status);
  }
  console.log((response.status === 409 ? 'kept directory ' : 'created directory ') + directory);
}

for (const file of files) {
  const content = await readFile(file.absolute, 'utf8');
  const type = file.path === 'main.ts' ? 'http' : 'file';
  let response = await api('PUT', file.path, { content, type });
  if (response.status === 404) {
    response = await api('POST', file.path, { content, type });
    if (!response.ok) throw new Error('Val Town file create failed for ' + file.path + ': HTTP ' + response.status);
    console.log('created ' + file.path);
  } else {
    if (!response.ok) throw new Error('Val Town file update failed for ' + file.path + ': HTTP ' + response.status);
    console.log('updated ' + file.path);
  }
}

console.log('Val Town deployment synced files=' + files.length + ' directories=' + directories.length);