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
      if(!(source==='damrok'&&relative==='index.html'))assert.deepEqual(readFileSync(path.join(output,target,relative)),readFileSync(file),relative);
      count++;
    }
  }
  const release=JSON.parse(readFileSync(path.join(output,'damrok/release.json'),'utf8'));
  const copies=walk(path.join(output,'damrok/releases',release.version));
  assert.equal(walk(output).length,count+2+copies.length,'only the release manifest and versioned assets are added');
  const html=readFileSync(path.join(output,'damrok/index.html'),'utf8');
  assert.match(release.version,/^[a-f0-9]{64}$/);
  assert(html.includes('content="'+release.version+'"'));
  assert(html.includes('bootstrap.mjs?v='+release.version));
  assert(html.includes('href="'+release.stylesheet+'"'));
  const account=readFileSync(path.join(output,'damrok/releases',release.version,'account.mjs'),'utf8');
  assert(account.includes('../../../firebase-vendor.js?v='+release.version));
  assert(readFileSync(path.join(output,'damrok/releases',release.version,'style.css'),'utf8').includes('../../../taste-drawer/fonts/ArnitUI.woff2?v='+release.version));
  for (const publicPath of ['index.html','sw.js','firebase-vendor.js','firebase-config.json','firebase-context.mjs','ledger/account.mjs','taste-drawer/index.html','taste-drawer/sw.js','damrok/index.html','damrok/account.mjs','functions/reminder-model.js']) {
    assert(statSync(path.join(output,publicPath)).isFile(),publicPath);
  }
});
