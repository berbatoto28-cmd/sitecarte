const {spawn}=require('child_process');const fs=require('fs');const assert=require('assert/strict');const path=require('path');const {DatabaseSync}=require('node:sqlite');const G=require('./lib/game');
const temp=fs.mkdtempSync(path.join(require('os').tmpdir(),'v20-test-'));const dbfile=path.join(temp,'test.db');const port=3137;
const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),DB_FILE:dbfile},stdio:['ignore','pipe','pipe']});let logs='';child.stderr.on('data',s=>logs+=s);child.stdout.on('data',s=>logs+=s);
let cookie='';async function api(p,body){const r=await fetch('http://127.0.0.1:'+port+p,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;}
(async()=>{try{
for(let i=0;i<60;i++){try{await api('/health');break;}catch(e){if(i===59)throw Error(logs);await new Promise(r=>setTimeout(r,100));}}
await api('/api/register',{name:'TestAlice',password:'test-v20-123'});const aliceCookie=cookie;await api('/api/register',{name:'TestBob',password:'test-v20-123'});cookie=aliceCookie;
const db=new DatabaseSync(dbfile);const bob=db.prepare('SELECT id FROM users WHERE name=?').get('TestBob').id;const astral=G.CARDS.find(c=>c.rarity==='astral');const common=G.CARDS.find(c=>c.rarity==='commune');db.prepare('INSERT INTO collection(user_id,card,qty,first_at) VALUES(?,?,?,?)').run(bob,astral.id,3,Date.now());db.prepare('INSERT INTO collection(user_id,card,qty,first_at) VALUES(?,?,?,?)').run(bob,common.id,1,Date.now());db.close();
let d=await api('/api/catalog');assert.equal(d.total,G.CARDS.length);assert.equal(d.stats.missing,G.CARDS.length);assert.equal(d.stats.uniq,0);
d=await api('/api/catalog?rarity=astral');assert.equal(d.total,G.CARDS.filter(c=>c.rarity==='astral').length);for(const c of Object.values(d.cards)){assert(c.name&&c.img&&!c.hidden);}
d=await api('/api/catalog?q='+encodeURIComponent(astral.name));assert(d.total>0);
d=await api('/api/catalog?player=TestBob&show=owned');assert.equal(d.total,2);assert.equal(d.stats.dupes,2);assert.equal(d.stats.uniq,2);assert.equal(d.quantities[astral.id],3);
d=await api('/api/catalog?player=TestBob&show=dupes');assert.deepEqual(d.ids,[astral.id]);
d=await api('/api/catalog?player=TestBob&show=missing');assert.equal(d.total,G.CARDS.length-2);
d=await api('/api/catalog?player=TestBob&serie='+astral.serie+'&rarity=astral&show=owned');assert.deepEqual(d.ids,[astral.id]);assert(d.stats.series[astral.serie].pct>0);
d=await api('/api/players/TestBob');assert.equal(d.player.stats.uniq,2);assert.equal(d.player.stats.dupes,2);
d=await api('/api/series/'+astral.serie);assert(d.cards.some(c=>c.id===astral.id&&c.name&&!c.hidden));
for(let i=1;i<d.cards.length;i++)assert(G.RANK[d.cards[i-1].rarity]>=G.RANK[d.cards[i].rarity],'Series sorted by rarity descending');
d=await api('/api/catalog?serie=naruto&sort=num&limit=72');
for(let i=1;i<d.ids.length;i++){const a=d.cards[d.ids[i-1]],b=d.cards[d.ids[i]];assert(G.RANK[a.rarity]>=G.RANK[b.rarity],'Default anime catalogue rarity descending');if(a.rarity===b.rarity)assert(a.fav>=b.fav,'Popularity tie-break');}
d=await api('/api/catalog?sort=num&limit=72');
const finished=new Set();let current='';let previous;
for(const id of d.ids){const c=d.cards[id];if(c.serie!==current){assert(!finished.has(c.serie),'Anime stays grouped');if(current)finished.add(current);current=c.serie;previous=null;}if(previous)assert(G.RANK[previous.rarity]>=G.RANK[c.rarity],'Grouped catalogue rarity descending');previous=c;}
for(const c of G.CARDS)assert.equal(G.maskCard(c,false),c);
for(const p of ['/api/static','/api/feed','/api/leaderboard','/api/players','/api/market','/api/trades'])await api(p);
console.log('PASS: full catalogue, all rarity metadata, character search, other player ownership/missing/duplicates, combined filters, series progress, profiles, series visibility and existing read APIs; '+G.CARDS.length+' IDs unchanged.');
}finally{child.kill();}})().catch(e=>{console.error(e);process.exitCode=1});
