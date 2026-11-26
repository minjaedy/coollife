// Private customer information and API responses are never stored in Cache Storage.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 if(event.request.mode==='navigate')event.respondWith(fetch(event.request,{cache:'no-cache'}).catch(()=>new Response('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width"><title>쿨라이프</title><body style="font-family:system-ui;padding:40px"><h1>인터넷 연결을 확인해 주세요</h1><p>고객 정보는 연결이 복구되면 확인할 수 있어요.</p><button onclick="location.reload()">다시 연결</button></body></html>',{headers:{'Content-Type':'text/html; charset=utf-8'}})));
});
