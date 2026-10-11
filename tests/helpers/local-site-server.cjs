/* Test-only HTTP server for real local Supabase browser E2E.
 * Serves known public application files. Never deploy this server.
 */
'use strict';
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const port=54330;
const routes=new Map([
  ['/','index.html'],
  ['/konto','konto.html'],
  ['/onboarding','onboarding.html'],
  ['/mein-laden','mein-laden.html'],
  ['/passwort-zuruecksetzen','passwort-zuruecksetzen.html'],
  ['/datenschutz','datenschutz.html'],
]);
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png',
  '.json':'application/json; charset=utf-8'};
http.createServer(async (req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:'+port);
  if (req.method!=='GET'||url.pathname.includes('..')) {
    res.writeHead(405);res.end();return;
  }
  const pathname=routes.get(url.pathname)||url.pathname.slice(1);
  if(!pathname||(!routes.has(url.pathname)&&!pathname.startsWith('assets/'))||
      pathname.includes('..')||pathname.startsWith('/')){
    res.writeHead(404);res.end();return;
  }
  const filepath=path.resolve(root,pathname);
  if (!filepath.startsWith(root+path.sep)) {res.writeHead(403);res.end();return;}
  try{
    const data=await fs.readFile(filepath);
    res.writeHead(200,{'Content-Type':types[path.extname(filepath)]||'application/octet-stream',
      'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(data);
  }catch(_){res.writeHead(404);res.end();}
}).listen(port,'127.0.0.1',()=>{process.stdout.write('Ladenfluss local UI ready at http://127.0.0.1:'+port+'\n');});
