import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('out/', root);
const html = await readFile(new URL('app/simulator.html', root), 'utf8');

await mkdir(output, { recursive: true });
await cp(new URL('public/', root), output, { recursive: true });
await writeFile(new URL('index.html', output), html.replace('<body>', '<body data-progress="local">'));
