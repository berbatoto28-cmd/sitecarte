const fs=require('node:fs'),assert=require('node:assert/strict');
const file=process.argv[2] || require('node:path').join(__dirname,'../data/cards.json');
const data=JSON.parse(fs.readFileSync(file,'utf8')),original=structuredClone(data);
const low=['commune','rare','epique','legendaire','mythique'];
const key=c=>(/\/character\/(?:large|medium|small)\/[a-z]?(\d+)/i.exec(c.img)||[])[1]||c.img;
const counts=new Map();
const slot=(c,r=c.rarity)=>key(c)+'|'+(low.includes(r)?c.serie+'|':'')+r;
const adjust=(c,n)=>counts.set(slot(c),(counts.get(slot(c))||0)+n);
for(const c of data.cards)adjust(c,1);
const bySerie=new Map(data.series.map(s=>[s.id,data.cards.filter(c=>c.serie===s.id && low.includes(c.rarity))]));
const changes=[];
for(const c of data.cards) {
 if(!low.includes(c.rarity)||(counts.get(slot(c))||0)<2)continue;
 const allowed=d=>d.rarity!==c.rarity && key(d)!==key(c) && !(counts.get(slot(c,d.rarity))||0) && !(counts.get(slot(d,c.rarity))||0);
 const candidates=bySerie.get(c.serie).filter(allowed).sort((a,b)=>Math.abs(low.indexOf(a.rarity)-low.indexOf(c.rarity))-Math.abs(low.indexOf(b.rarity)-low.indexOf(c.rarity))||b.fav-a.fav||a.id.localeCompare(b.id));
 const donor=candidates[0];
 if(!donor) {
  const to=[...low].sort((a,b)=>Math.abs(low.indexOf(a)-low.indexOf(c.rarity))-Math.abs(low.indexOf(b)-low.indexOf(c.rarity))).find(r=>!(counts.get(slot(c,r))||0));
  if(!to)throw Error('No distinct lower rarity available: '+c.id);
  const from=c.rarity;adjust(c,-1);c.rarity=to;adjust(c,1);delete c.v;delete c.astral;if(c.theme==='astral')delete c.theme;
  changes.push({id:c.id,name:c.name,from,to,reason:'No same-series swap possible'});continue;
 }
 const from=c.rarity,to=donor.rarity;
 adjust(c,-1);adjust(donor,-1);
 c.rarity=to;donor.rarity=from;
 adjust(c,1);adjust(donor,1);
 for(const card of [c,donor]) {delete card.v;delete card.astral;if(card.theme==='astral')delete card.theme;}
 changes.push({id:c.id,name:c.name,from,to,exchangedWith:donor.id,otherName:donor.name});
}
const remaining=[...counts].filter(([k,n])=>n>1);
assert.equal(remaining.length,0,JSON.stringify(remaining.slice(0,5)));
for(let i=0;i<data.cards.length;i++)for(const field of ['id','num','serie','name','native','img','art','fav'])assert.deepEqual(data.cards[i][field],original.cards[i][field]);
for(let i=0;i<data.cards.length;i++)if(!low.includes(original.cards[i].rarity))assert.equal(data.cards[i].rarity,original.cards[i].rarity);
fs.writeFileSync(file,JSON.stringify(data));
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify({policy:'Keep variants across different rarities; no repeated character within one rarity of the same anime. Global elite uniqueness preserved. All elite assignments, IDs, numbers, names, artwork and card order unchanged.',corrections:changes.length,changes},null,2));
console.log(JSON.stringify({swaps:changes.length,remaining:remaining.length,itachi:data.cards.filter(c=>c.name==='Itachi Uchiha').map(c=>({id:c.id,num:c.num,rarity:c.rarity}))}));
