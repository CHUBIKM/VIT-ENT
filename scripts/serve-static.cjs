const http=require('node:http');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'../dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const prefix='/ENT-Project-VIT-SMART/';
const server=http.createServer((req,res)=>{
 let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 if(name==='/ENT-Project-VIT-SMART'){res.writeHead(302,{Location:prefix}).end();return;}
 if(name.startsWith(prefix))name=name.slice(prefix.length);else name=name.slice(1);
 if(!name||name.endsWith('/'))name+='index.html';
 const file=path.resolve(root,name);
 if(!file.startsWith(root+path.sep)||name.split('/').some(x=>x.startsWith('.'))){res.writeHead(403).end();return;}
 fs.readFile(file,(err,body)=>{if(err){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);});
});
server.listen(Number(process.env.PORT||4922),'127.0.0.1',()=>console.log(`Static preview: http://localhost:${server.address().port}${prefix}`));
