const r=require('./runs.json');
const q=(a,p)=>{const s=a.slice().sort((x,y)=>x-y);return s.length?s[Math.floor(s.length*p/100)]:0;};
const avg=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):0;
const j=x=>x.lineSet.join('|')+x.titleSet.join('|');
function cls(x){
  if(x.unified) return '👑天下統一';
  if(/後繼無人/.test(x.lineSet.join('|'))) return '☠絕嗣';
  if(/大坂落城/.test(x.titleSet.join('|'))) return '🔥大坂殉義';
  if(/駿府の春/.test(x.titleSet.join('|'))) return '🌸If線';
  if(x.year>=1615) return '🎌存續至終';
  return '?'+x.year;
}
r.forEach(x=>x._c=cls(x));
console.log('══════════ 總覽 (n='+r.length+') ══════════');
console.log('錯誤',r.filter(x=>x.err).length,'| 稽核違規',r.filter(x=>x.audits&&x.audits.length).length);
const ends={}; r.forEach(x=>ends[x._c]=(ends[x._c]||0)+1);
Object.entries(ends).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(' ',String(v).padStart(3),k));
function table(title,key){
  console.log('');
  console.log('══ 依'+title+' ══');
  const m={}; r.forEach(x=>{(m[x[key]]=m[x[key]]||[]).push(x);});
  console.log('  '+'名'.padEnd(9)+'局'.padStart(3)+' 石高p50 錢p50 威望 兵  昇格% 絕嗣% 討取 決策/季');
  Object.entries(m).forEach(([k,v])=>{
    console.log('  '+String(k).padEnd(9)+String(v.length).padStart(3)+
      String(q(v.map(x=>x.koku),50)).padStart(7)+
      String(q(v.map(x=>x.money),50)).padStart(6)+
      String(q(v.map(x=>x.prest),50)).padStart(5)+
      String(q(v.map(x=>x.sol),50)).padStart(5)+
      String(Math.round(v.filter(x=>x.daimyo).length/v.length*100)).padStart(6)+
      String(Math.round(v.filter(x=>x._c==='☠絕嗣').length/v.length*100)).padStart(6)+
      String(avg(v.map(x=>x.slain||0))).padStart(5)+
      String(q(v.map(x=>+(x.modals/((x.year-1545)*4||1)).toFixed(2)),50)).padStart(8));
  });
}
table('性格','persona');
table('區域','region');
table('模式','mode');
console.log('');
console.log('══ 性格×區域 石高p50(找極端組合) ══');
const pr={};
r.forEach(x=>{const k=x.persona+'@'+x.region;(pr[k]=pr[k]||[]).push(x.koku);});
const cells=Object.entries(pr).map(([k,v])=>({k,n:v.length,m:q(v,50)})).sort((a,b)=>b.m-a.m);
cells.slice(0,4).forEach(c=>console.log('  最強',c.k.padEnd(16),c.m,'('+c.n+'局)'));
cells.slice(-4).forEach(c=>console.log('  最弱',c.k.padEnd(16),c.m,'('+c.n+'局)'));
console.log('');
console.log('══ 系統參與率 ══');
[['國戰',/國戰/],['討取',/討取】/],['寝返り(武將)',/出奔,轉仕/],['遺臣來投',/遺臣來投/],
 ['風聞介入',/兵鋒指向/],['趁虛而來',/趁虛而來/],['包圍網',/包圍網/],['姻親盟友守望',/守望相助/],
 ['大名縁組',/縁組|入嫁/],['名將入幕',/入幕|出仕.*家!鄉里/],['專屬兵種遇敵',/石火矢|亂波|僧兵|焙烙/],
 ['一揆',/一揆/],['家督之憂',/家督之憂/],['昇格之路',/昇格之路/]].forEach(([n,re])=>
  console.log(' ',n.padEnd(12), Math.round(r.filter(x=>re.test(j(x))).length/r.length*100)+'%'));
console.log('');
console.log('══ 決策密度與事件多樣性 ══');
console.log('  每季決策 p25/50/90:', q(r.map(x=>+(x.modals/((x.year-1545)*4||1)).toFixed(2)),25), q(r.map(x=>+(x.modals/((x.year-1545)*4||1)).toFixed(2)),50), q(r.map(x=>+(x.modals/((x.year-1545)*4||1)).toFixed(2)),90));
console.log('  事件種類 p50:', q(r.map(x=>x.kinds),50));
console.log('  視窗風暴:', r.filter(x=>x.storm).length);
