import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// vMenu identifies a plugin by its resource name, so renaming this renames its permissions and settings too.
const resourceName = 'vMenu.RoutingBucketsPlugin';

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, 'build', resourceName);
const version = process.env.VERSION || JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

// A test server pointed at this folder saves its worlds in buckets.json, so that survives the clean out.
const savedWorlds = join(out, 'buckets.json');
const worlds = existsSync(savedWorlds) ? readFileSync(savedWorlds) : undefined;

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

if (worlds) {
  writeFileSync(savedWorlds, worlds);
}

// FiveM loads plain scripts, not modules, so each side becomes one self contained file.
const shared = { bundle: true, format: 'iife', target: 'es2020', logLevel: 'warning' };

await build({
  ...shared,
  entryPoints: [join(root, 'src/client/client.ts')],
  platform: 'browser',
  outfile: join(out, 'client.js'),
});
await build({
  ...shared,
  entryPoints: [join(root, 'src/server/server.ts')],
  platform: 'node',
  outfile: join(out, 'server.js'),
});

const manifest = readFileSync(join(root, 'fxmanifest.lua'), 'utf8').replace('versiongoeshere', version);

writeFileSync(join(out, 'fxmanifest.lua'), manifest);

for (const file of ['README.md', 'LICENSE.md']) {
  copyFileSync(join(root, file), join(out, file));
}

console.log(`Resource ready: ${out} (version ${version})`);
