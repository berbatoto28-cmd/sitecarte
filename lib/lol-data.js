/* League of Legends — édition spéciale AnimeConnection.
 * Roster gelé pour la collection 2026; source splash Riot Data Dragon.
 * Raretés éditoriales provisoires, top 4 fondé sur les pick rates 26.22,
 * Émeraude+ / monde / tous rôles (BananaSmite).
 */
'use strict';
const IDS=["Kaisa","Jhin","Ezreal","Sylas","Thresh","Lulu","LeeSin","Yunara","Ahri","Nautilus","Caitlyn","Jinx","Nami","Syndra","Leona","Xayah","Yone","Lux","MissFortune","Yasuo","Zed","Viego","Akali","Darius","Jax","Irelia","Pyke","Fiora","Hecarim","Zeri","Rell","Braum","Viktor","Milio","Riven","Sett","Garen","MasterYi","Katarina","Morgana","Seraphine","Aatrox","Ashe","Blitzcrank","Brand","Draven","Ekko","Evelynn","Fiddlesticks","Galio","Gangplank","Gragas","Graves","Gwen","Hwei","Jayce","Kayn","Khazix","Kindred","Leblanc","Lucian","Malphite","Mel","Mordekaiser","Neeko","Nocturne","Pantheon","Poppy","Qiyana","Rakan","Renekton","Rengar","Rumble","Ryze","Samira","Sejuani","Senna","Shaco","Shen","Sion","Sivir","Smolder","Soraka","Swain","Taliyah","Talon","Taric","Teemo","Tristana","Trundle","Tryndamere","TwistedFate","Twitch","Udyr","Varus","Vayne","Veigar","Velkoz","Vex","Vi","Vladimir","Volibear","Warwick","Wukong","Xerath","XinZhao","Yorick","Yuumi","Zac","Ziggs","Zilean","Zoe","Zyra","AurelionSol","Aurora","Azir","Akshan","Alistar","Ambessa","Amumu","Anivia","Annie","Aphelios","Bard","Belveth","Briar","Camille","Cassiopeia","Chogath","Corki","Diana","DrMundo","Elise","Fizz","Gnar","Heimerdinger","Illaoi","Ivern","Janna","JarvanIV","Kalista","Karma","Karthus","Kassadin","Kayle","Kennen","Kled","KogMaw","Lillia","Lissandra","Malzahar","Maokai","Naafiri","Nasus","Nidalee","Nilah","Nunu","Olaf","Orianna","Ornn","Quinn","Rammus","Reksai","Renata","Shyvana","Singed","Skarner","Sona","TahmKench","Urgot","KSante","Zaahen","Locke"];
const LABELS={"Kaisa":"Kai'Sa","Khazix":"Kha'Zix","Chogath":"Cho'Gath","KogMaw":"Kog'Maw","Velkoz":"Vel'Koz","KSante":"K'Sante","Leblanc":"LeBlanc","LeeSin":"Lee Sin","MissFortune":"Miss Fortune","AurelionSol":"Aurelion Sol","MasterYi":"Master Yi","DrMundo":"Dr. Mundo","TwistedFate":"Twisted Fate","JarvanIV":"Jarvan IV","XinZhao":"Xin Zhao","TahmKench":"Tahm Kench","Belveth":"Bel'Veth","Reksai":"Rek'Sai","Nunu":"Nunu et Willump","Renata":"Renata Glasc","Wukong":"Wukong"};
const ASTRAL={ Kaisa:29, Jhin:5, Ezreal:5, Sylas:1 };
const SERIE_ID='lol-runeterra';
const splash=(id,skin=0)=>'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/'+id+'_'+skin+'.jpg';
function install(data) {
 if (data.series.some(s=>s.id===SERIE_ID)) return;
 const unique=new Set(IDS);
 if(unique.size!==173) throw Error('Le roster LOL doit contenir exactement 173 champions');
 const cards=IDS.map((id,i)=>{
  const rarity=i<8?'mythique':i<23?'legendaire':i<43?'epique':i<113?'rare':'commune';
  return {id:'LOL-'+String(i+1).padStart(3,'0'),num:'LOL-'+String(i+1).padStart(3,'0'),
    name:LABELS[id]||id,serie:SERIE_ID,rarity,fav:Math.max(1,173-i),img:splash(id),art:splash(id),skin:'Classique',
    source:'Riot Games',championId:id};
 });
 for (const [j,id] of Object.keys(ASTRAL).entries()) {
  cards.push({id:'LOL-A'+String(j+1).padStart(2,'0'),num:'LOL-A'+String(j+1).padStart(2,'0'),
    name:LABELS[id]||id,serie:SERIE_ID,rarity:'astral',fav:10000-j,img:splash(id,ASTRAL[id]),
    art:splash(id,ASTRAL[id]),skin:['K/DA ALL OUT','Dark Cosmic','Pulsefire','Freljord'][j],
    source:'Riot Games',championId:id,variant:'Astral'});
 }
 const series={id:SERIE_ID,code:'LOL',name:'League of Legends',title:'League of Legends · Édition Astrale',
  kind:'special',special:true,featured:true,theme:'lol',color:'#aa75ff',
  cover:splash('Kaisa',29),banner:splash('Jhin',5),pop:10000,count:cards.length,
  desc:'173 champions à collectionner et seulement quatre Astral. Raretés selon le classement de popularité établi pour cette édition.'};
 data.series.unshift(series);data.cards.push(...cards);
}
module.exports={install,SERIE_ID,IDS,ASTRAL};
