/* Audit des nouvelles cartes Summer Waifus, sans modification du catalogue ni publication.
 * npm run summer:audit
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'summer-waifus-expansion-v21.json'),'utf8'));
const data=JSON.parse(fs.readFileSync(path.join(root,'data','cards.json'),'utf8'));
const summerSeries=new Set(data.series.filter(s=>s.special && /summer/i.test([s.name,s.title,s.theme,s.id].join(' '))).map(s=>s.id));
if(!summerSeries.size) throw Error('Impossible de localiser la collection Summer Waifus');
const existing=data.cards.filter(c=>summerSeries.has(c.serie));
const rows=manifest.candidates.map(c=>{
 const aliases=new Set([c.name,...c.aliases].map(normalize));
 const matches=existing.filter(card=>aliases.has(normalize(card.name)));
 return {name:c.name,rarity:c.rarity,existing:matches.map(m=>({id:m.id,name:m.name,rarity:m.rarity})),
  decision:matches.length?'DOUBLON - NE PAS AJOUTER':c.artAsset?'À VALIDER':'ILLUSTRATION MANQUANTE'};
});
const report={summerSeries:[...summerSeries],existingCards:existing.length,candidates:rows.length,
 duplicates:rows.filter(r=>r.existing.length).length,needsArtwork:rows.filter(r=>!r.existing.length&&r.decision==='ILLUSTRATION MANQUANTE').length,rows};
process.stdout.write(JSON.stringify(report,null,2)+'\n');
