(async()=>{
 const assert=require('node:assert/strict');
 const G=require('../lib/game');
 const {S,setData}=await import('../public/js/core.js');
 const {cardHTML}=await import('../public/js/cards.js');
 setData(G.publicData());
 const specials=G.CARDS.filter(c=>G.SERIE[c.serie].special&&c.serie!=='lol-runeterra');
 assert.equal(specials.length,103);
 for(const c of specials){
  assert(G.RANK[c.rarity]>=G.RANK.legendaire);
  S.card[c.id]=c;
  const html=cardHTML(c.id,{static:true});
  assert(html.includes('is-special-edition'));
  assert(!html.includes('elite-primordial-sun')&&!html.includes('elite-secret-cipher'));
  if(c.rarity==='primordiale')assert(html.includes('c-galaxy'));
  if(c.serie==='summer')assert.equal(c.art,`/art/summer/${c.num}.webp`);
 }
 const expected={summer:{primordiale:1,secrete:3,mythique:7,legendaire:32},legends:{primordiale:1,secrete:3,mythique:6,legendaire:20},villains:{primordiale:1,secrete:3,mythique:6,legendaire:20}};
 for(const [id,counts] of Object.entries(expected))assert.deepEqual(specials.filter(c=>c.serie===id).reduce((a,c)=>(a[c.rarity]=(a[c.rarity]||0)+1,a),{}),counts);
 assert.equal(G.CARDS.filter(c=>c.serie==='lol-runeterra').length,177);
 console.log('PASS: 103 special editions restored, Legendary minimum, original Summer artwork and legacy frames; LOL unchanged.');
})().catch(e=>{console.error(e);process.exitCode=1});
