import {createDamrokRelease} from './damrok-release.mjs';
import {cpSync, mkdirSync, readdirSync, rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const output = path.join(root, '_site');
export function build() {
  rmSync(output, {recursive:true, force:true});
  mkdirSync(output, {recursive:true});
  // Preserve public paths, service-worker scopes, installed apps and browser storage.
  for (const [source, target] of [['harugyeol',''], ['shared',''], ['arnit','taste-drawer'], ['damrok','damrok']]) {
    const directory = path.join(root, source);
    for (const entry of readdirSync(directory)) {
      cpSync(path.join(directory,entry), path.join(output,target,entry), {recursive:true});
    }
  }
  cpSync(path.join(root,'.nojekyll'),path.join(output,'.nojekyll'));
  createDamrokRelease(root,output);
  return output;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(build());
}
