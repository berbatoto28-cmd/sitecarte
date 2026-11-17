'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {DatabaseSync}=require('node:sqlite');
const G=require('../lib/game');
const temp=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'missions-bulk-'));
const dbfile=path.join(temp,'test.db');
const port=3148;
const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),DB_FILE:dbfile},stdio:['ignore','pipe','pipe']});
let logs='',cookie='',db;
child.stderr.on('data',s=>logs+=s);child.stdout.on('data',s=>logs+=s);
async function request(p,body,auth=cookie) {
 const r=await fetch(`http://127.0.0.1:${port}`+p,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Cookie:auth},body:body===undefined?undefined:JSON.stringify(body)});
 if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];
 return {status:r.status,data:await r.json()};
}
async function api(p,b){const r=await request(p,b);assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}
(async()=>{try{
 for(let i=0;i<80;i++){try{await api('/health');break;}catch(e){if(i===79)throw Error(logs);await new Promise(r=>setTimeout(r,100));}}
 assert.equal((await request('/api/missions/claim-all',{},'')).status,401);
 await api('/api/register',{name:'MissionTest',password:'local-test-123'});
 const ownerCookie=cookie;
 await api('/api/register',{name:'UntouchedPlayer',password:'local-test-123'});
 cookie=ownerCookie;
 db=new DatabaseSync(dbfile);
 const uid=db.prepare('SELECT id FROM users WHERE name=?').get('MissionTest').id;
 const otherBefore=db.prepare('SELECT coins FROM users WHERE name=?').get('UntouchedPlayer');
 await api('/api/missions');
 db.prepare('UPDATE daily SET progress=100000 WHERE user_id=?').run(uid);
 const series=G.SERIES.filter(s=>!s.special).slice(0,40);
 const insert=db.prepare('INSERT INTO collection(user_id,card,qty,first_at) VALUES(?,?,?,?)');
 for(const [i,s] of series.entries()) for(const c of G.CARDS.filter(c=>c.serie===s.id).slice(0,i===0?s.count:Math.ceil(s.count*.25)))insert.run(uid,c.id,2,Date.now());
 db.prepare('INSERT INTO counters(user_id,key,value) VALUES(?,?,?)').run(uid,'pack_open',100);
 db.prepare('INSERT INTO achievements(user_id,id,claimed_at) VALUES(?,?,?)').run(uid,'packs10',Date.now());
 const state=(await api('/api/missions')).missions;
 const completed=[...state.daily,state.bonus].filter(m=>!m.claimed&&m.progress>=m.target).map(m=>({id:m.id,reward:m.reward}));
 for(const a of state.achievements){const def=G.ACH[a.id];if(!a.claimed&&a.progress>=def.target)completed.push({id:a.id,reward:def.reward});}
 for(const s of state.series)for(const st of G.SERIE_STEPS){const step=G.serieStep(s.id,st.k);if(s.owned>=step.target&&!s.claimed.includes(st.k))completed.push({id:step.id,reward:step.reward});}
 assert(state.series.length>36);
 const coins=completed.reduce((sum,m)=>sum+(m.reward.coins||0),0),packs={};
 for(const m of completed)for(const [p,n] of Object.entries(m.reward.packs||{}))packs[p]=(packs[p]||0)+n;
 const beforeUser=db.prepare('SELECT coins FROM users WHERE id=?').get(uid);
 const beforeInventory=Object.fromEntries(db.prepare('SELECT pack,qty FROM inventory WHERE user_id=?').all(uid).map(r=>[r.pack,r.qty]));
 const beforeCollection=db.prepare('SELECT card,qty FROM collection WHERE user_id=? ORDER BY card').all(uid);
 // A failed pack credit must roll back coins and all claim markers.
 db.exec("CREATE TRIGGER fail_reward BEFORE UPDATE ON inventory BEGIN SELECT RAISE(ABORT, 'test rollback'); END");
 assert.equal((await request('/api/missions/claim-all',{})).status,500);
 assert.deepEqual(db.prepare('SELECT coins FROM users WHERE id=?').get(uid),beforeUser);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM daily WHERE user_id=? AND claimed=1').get(uid).n,0);
 db.exec('DROP TRIGGER fail_reward');
 const responses=await Promise.all([api('/api/missions/claim-all',{}),api('/api/missions/claim-all',{})]);
 assert.equal(responses.reduce((sum,r)=>sum+r.count,0),completed.length);
 const claimed=responses.flatMap(r=>r.claimed).sort();
 assert.deepEqual(claimed,completed.map(m=>m.id).sort());
 assert.equal(db.prepare('SELECT coins FROM users WHERE id=?').get(uid).coins,beforeUser.coins+coins);
 const afterInventory=Object.fromEntries(db.prepare('SELECT pack,qty FROM inventory WHERE user_id=?').all(uid).map(r=>[r.pack,r.qty]));
 for(const p of new Set([...Object.keys(beforeInventory),...Object.keys(packs)]))assert.equal(afterInventory[p]||0,(beforeInventory[p]||0)+(packs[p]||0));
 assert.deepEqual(db.prepare('SELECT card,qty FROM collection WHERE user_id=? ORDER BY card').all(uid),beforeCollection);
 assert.deepEqual(db.prepare('SELECT coins FROM users WHERE name=?').get('UntouchedPlayer'),otherBefore);
 assert.equal((await api('/api/missions/claim-all',{})).count,0);
 assert.equal((await request('/api/missions/claim',{id:claimed[0]})).status,400);
 assert.equal((await api('/api/missions/claim-all',{})).me.notif.missions,0);
 console.log(`PASS: ${completed.length} daily, bonus, achievement and 40-series rewards; exact coin/pack totals; rollback, authentication, concurrent/repeated requests, unchanged collections and other player.`);
}finally{if(db)db.close();child.kill();}})().catch(e=>{console.error(e);process.exitCode=1});
