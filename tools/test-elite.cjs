'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const G=require('../lib/game');
const tiers=['astral','primordiale','secrete'];
const elite=G.CARDS.filter(c=>tiers.includes(c.rarity));
const identity=c=>c.championId?'riot:'+c.championId:'anilist:'+/\/character\/(?:large|medium|small)\/[a-z]?(\d+)/i.exec(c.img)[1];
for(const get of [identity,c=>c.img.split(/[?#]/)[0],c=>c.art||c.img]) {
 const seen=new Map();
 for(const c of elite) {const k=get(c);assert(!seen.has(k),`Duplicate ${k}: ${seen.get(k)} / ${c.id}`);seen.set(k,c.id);}
}
for(const s of G.SERIES.filter(s=>!s.special)) {
 const cards=elite.filter(c=>c.serie===s.id).sort((a,b)=>tiers.indexOf(a.rarity)-tiers.indexOf(b.rarity)||b.fav-a.fav);
 for(let i=1;i<cards.length;i++) assert(cards[i-1].fav>=cards[i].fav,`Popularity order: ${s.id}`);
}
for(const [name,pack] of Object.entries(G.PACKS)) {
 for(let i=0;i<100;i++) {
  const cards=G.drawPack(name,pack.perSet?'legends':pack.perSerie?'aot':undefined,false);
  assert.equal(cards.length,5);
  for(const c of cards) assert(c && G.CARD[c.id]);
  if(name==='secretgift') assert.equal(cards.filter(c=>c.rarity==='secrete').length,1);
 }
}
for(let i=0;i<50;i++) assert.deepEqual(G.drawTestPack().map(c=>c.rarity),['epique','legendaire','mythique','secrete','primordiale','astral']);
console.log(`PASS: ${elite.length} unique elite characters and portraits, per-anime popularity order, 800 packs and 50 test packs.`);
