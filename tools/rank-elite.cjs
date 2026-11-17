'use strict';
// Character identity and collection IDs stay fixed; only rarity is reassigned.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) throw Error('Usage: node tools/rank-elite.cjs input.json output.json [report.json]');
const data = JSON.parse(fs.readFileSync(input, 'utf8'));
const original = structuredClone(data);
const tiers = ['astral', 'primordiale', 'secrete'];
const norm = x => String(x || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const portrait = c => String(c.img || '').split(/[?#]/)[0].toLowerCase();
const identity = c => c.championId ? 'riot:' + c.championId :
  'anilist:' + (c.characterId || c.anilistCharacterId || /\/character\/(?:large|medium|small)\/[a-z]?(\d+)/i.exec(c.img || '')?.[1] || norm(c.from || c.serie) + ':' + norm(c.name));
const score = c => Number(c.fav) || 0;
const bySeries = new Map(data.series.map(s => [s.id, data.cards.filter(c => c.serie === s.id)]));
const used = new Set(), images = new Set(), art = new Set(), selected = new Map();
const report = {source: data.source, popularity: 'Recorded AniList favourites (fav); not a live ranking',
  policy: 'Per anime: Astral, then Primordiale, then up to three Secrete. Shared characters belong to the most popular eligible series; no global elite repeats. Existing IDs, numbers, names and images are preserved.',
  series: [], changes: []};
const ordered = [...data.series].sort((a,b) => Number(!!a.special) - Number(!!b.special) || (b.pop || 0) - (a.pop || 0) || a.id.localeCompare(b.id));
for (const s of ordered) {
  const cards = bySeries.get(s.id);
  const candidates = new Map();
  for (const c of cards) {
    const key = identity(c);
    const prior = candidates.get(key);
    if (!prior || score(c) > score(prior)) candidates.set(key,c);
  }
  const ranked = [...candidates.values()].sort((a,b) => score(b)-score(a) || identity(a).localeCompare(identity(b)));
  const desired = tiers.flatMap(r => Array(cards.filter(c=>c.rarity===r).length).fill(r));
  const assignments = [];
  let next = 0;
  for (const rarity of desired) {
    let candidate;
    while (next < ranked.length) {
      const c = ranked[next++];
      if (!used.has(identity(c)) && !images.has(portrait(c)) && (!c.art || !art.has(c.art))) { candidate = c; break; }
    }
    if (!candidate) break;
    const matching = cards.filter(c=>identity(c)===identity(candidate));
    // Prefer the existing slot for this rarity; no character or artwork is copied.
    const slot = matching.find(c=>c.rarity===rarity) || matching.find(c=>!tiers.includes(c.rarity)) || matching[0];
    selected.set(slot.id,rarity);
    used.add(identity(slot)); images.add(portrait(slot)); if(slot.art) art.add(slot.art);
    assignments.push({id:slot.id,num:slot.num,name:slot.name,character:identity(slot),rarity,favourites:score(slot)});
  }
  report.series.push({id:s.id,name:s.name,assignments,unfilled:desired.length-assignments.length});
}
for (const c of data.cards) {
  const before = c.rarity;
  c.rarity = selected.get(c.id) || (tiers.includes(c.rarity) ? 'mythique' : c.rarity);
  if (before !== c.rarity) {
    if(c.rarity==='astral') {c.astral=true;c.v='a';}
    else {delete c.astral; if(c.theme==='astral') delete c.theme; if(tiers.includes(c.rarity)) c.v=c.rarity==='primordiale'?'p':'s';else delete c.v;}
    report.changes.push({id:c.id,num:c.num,name:c.name,from:before,to:c.rarity});
  }
}
assert.equal(data.cards.length, original.cards.length);
for(let i=0;i<data.cards.length;i++) for(const k of ['id','num','serie','name','native','img','art','fav']) assert.deepEqual(data.cards[i][k],original.cards[i][k],k);
const elite=data.cards.filter(c=>tiers.includes(c.rarity));
for(const key of [identity,portrait]) assert.equal(new Set(elite.map(key)).size,elite.length,'Elite duplicates');
report.totalCards=data.cards.length;
report.totalElite=elite.length;
report.counts=Object.fromEntries(tiers.map(r=>[r,elite.filter(c=>c.rarity===r).length]));
report.duplicateCharacters=0;report.duplicatePortraits=0;
fs.writeFileSync(output,JSON.stringify(data));
if(process.argv[4]) fs.writeFileSync(process.argv[4],JSON.stringify(report,null,2));
console.log(JSON.stringify({cards:report.totalCards,elite:report.totalElite,counts:report.counts,changed:report.changes.length,unfilled:report.series.filter(s=>s.unfilled).length}));
