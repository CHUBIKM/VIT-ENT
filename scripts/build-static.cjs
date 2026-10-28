const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const files=['index.html','dashboard.html','assets/style.css','assets/app.mjs','assets/ai.mjs','assets/pose.mjs','assets/mark.svg'];
const out=path.join(root,'dist');fs.rmSync(out,{recursive:true,force:true});
for(const file of files){const target=path.join(out,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,'public',file),target);}
fs.writeFileSync(path.join(out,'.nojekyll'),'');
console.log(`Static build: ${files.length} public files + .nojekyll. No server, keys, or databases included.`);
