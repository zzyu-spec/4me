/* Run only when ready to provision the server. Never prints or writes a secret into Pages. */
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),webPush=require('web-push');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'harugyeol-vapid-'));fs.chmodSync(dir,0o700);
const keys=webPush.generateVAPIDKeys(),file=path.join(dir,'private-key');fs.writeFileSync(file,keys.privateKey,{mode:0o600});
console.log('Public VAPID key: '+keys.publicKey);console.log('Private key file (0600; upload to Secret Manager, then remove): '+file);
