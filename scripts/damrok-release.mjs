import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import path from 'node:path';
export function createDamrokRelease(root,output){
 const source=path.join(root,'damrok'),target=path.join(output,'damrok');
 const files=readdirSync(source).filter(f=>/\.(mjs|css|svg|html)$/.test(f)).sort();
 const digest=createHash('sha256');for(const file of files)digest.update(file+'\0').update(readFileSync(path.join(source,file)));
 for(const file of ['firebase-vendor.js','firebase-config.json','firebase-context.mjs'])digest.update(file+'\0').update(readFileSync(path.join(output,file)));
 digest.update(readFileSync(new URL(import.meta.url)));const version=digest.digest('hex'),prefix='releases/'+version+'/',directory=path.join(target,prefix);
 mkdirSync(directory,{recursive:true});
 for(const file of files.filter(f=>f!=='bootstrap.mjs'&&f!=='index.html')){
  let content=readFileSync(path.join(source,file),'utf8');
  // The public shared files stay at /4me/. Only the release copies need a deeper path.
  if(/\.(mjs|css)$/.test(file))content=content.replace(/(['"])\.\.\/([^'"]+)\1/g,(_,quote,file)=>quote+'../../../'+file+(file.includes('?')?'&':'?')+'v='+version+quote);
  writeFileSync(path.join(directory,file),content);
 }
 const release={version,entry:prefix+'app.mjs',stylesheet:prefix+'style.css'};
 writeFileSync(path.join(target,'release.json'),JSON.stringify(release)+'\n');
 let html=readFileSync(path.join(source,'index.html'),'utf8');
 html=html.replace('content="development"',`content="${version}"`).replace('href="style.css"',`href="${release.stylesheet}"`).replace('src="bootstrap.mjs"',`src="bootstrap.mjs?v=${version}"`);
 writeFileSync(path.join(target,'index.html'),html);
 return release;
}
