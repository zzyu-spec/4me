import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import path from 'node:path';
import {build, root} from './build-site.mjs';
function walk(directory) {
  return readdirSync(directory).flatMap(name => {
    const file=path.join(directory,name);
    return statSync(file).isDirectory()?walk(file):[file];
  });
}
test('every service file retains its exact bytes and previous public path', () => {
  const output=build();
  let count=0;
  for (const [source,target] of [['harugyeol',''],['shared',''],['arnit','taste-drawer'],['damrok','damrok']]) {
    for (const file of walk(path.join(root,source))) {
      const relative=path.relative(path.join(root,source),file);
      assert.deepEqual(readFileSync(path.join(output,target,relative)),readFileSync(file),relative);
      count++;
    }
  }
  assert.equal(walk(output).length,count+1,'no file collision or unexpected output');
  for (const publicPath of ['index.html','sw.js','firebase-vendor.js','firebase-config.json','firebase-context.mjs','ledger/account.mjs','taste-drawer/index.html','taste-drawer/sw.js','damrok/index.html','damrok/account.mjs','functions/reminder-model.js']) {
    assert(statSync(path.join(output,publicPath)).isFile(),publicPath);
  }
});
