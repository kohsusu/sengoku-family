const r=require('./runs.json');
const med=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:0;};
const avg=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):0;
function cls(x){
  const L=x.logSet.join('|'), T=x.titleSet.join('|');
  if(x.unified) return '👑天下統一';
  if(/後繼無人——家名斷絕/.test(L) || /後繼無人/.test(x.lineSet.join('|'))) return '☠絕嗣・家名斷絕';
  if(/大坂落城/.test(T)) return '🔥大坂殉義滅亡';
  if(/駿府の春/.test(T)) return '🌸駿府の春(If線)';
  if(x.year>=1615) return '🎌元和偃武・存續至終';
  return '?其他 y'+x.year;
}
r.forEach(x=>x._c=cls(x));
const c={}; r.forEach(x=>c[x._c]=(c[x._c]||0)+1);
console.log('=== 結局分佈 (n='+r.length+') ===');
Object.entries(c).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log('  '+String(v).padStart(3)+'　'+k));
const surv=r.map(x=>x.year-1545);
console.log('\n存活年數 中位'+med(surv)+' 平均'+avg(surv)+' 最短'+Math.min(...surv));
console.log('絕嗣中位年:', med(r.filter(x=>x._c.startsWith('☠')).map(x=>x.year-1545)));

const grp=(key)=>{const m={}; r.forEach(x=>{(m[x[key]]=m[x[key]]||[]).push(x);}); return m;};
for(const [label,key] of [['家族類型','clan'],['玩家性格','persona'],['開局模式','mode']]){
  console.log('\n=== 依'+label+' ===');
  const m=grp(key);
  console.log('  '+'名稱'.padEnd(10)+'場'.padStart(4)+'存活年'.padStart(7)+'終石高'.padStart(8)+'威望'.padStart(6)+'兵'.padStart(6)+'昇格%'.padStart(7)+'絕嗣%'.padStart(7));
  Object.entries(m).forEach(([k,v])=>{
    console.log('  '+String(k).padEnd(10)+String(v.length).padStart(4)+
      String(avg(v.map(x=>x.year-1545))).padStart(7)+
      String(med(v.map(x=>x.koku))).padStart(8)+
      String(med(v.map(x=>x.prest))).padStart(6)+
      String(med(v.map(x=>x.sol))).padStart(6)+
      String(Math.round(v.filter(x=>x.daimyo).length/v.length*100)).padStart(7)+
      String(Math.round(v.filter(x=>x._c.startsWith('☠')).length/v.length*100)).padStart(7));
  });
}
console.log('\n=== 終局資源(中位) ===');
['koku','prest','pop','sol','rice','money','minshin','retainers','gens','vassals','fort','kani','slain','aggression'].forEach(k=>{
  console.log('  '+k.padEnd(11), med(r.map(x=>x[k]||0)), ' 最大', Math.max(...r.map(x=>x[k]||0)));
});
console.log('\n=== 決策密度 ===');
const dens=r.map(x=>+(x.modals/((x.year-1545)*4)).toFixed(2));
console.log('  每季抉擇 中位', med(dens), '範圍', Math.min(...dens), '~', Math.max(...dens));
console.log('  事件種類 中位', med(r.map(x=>x.kinds)), '範圍', Math.min(...r.map(x=>x.kinds)), '~', Math.max(...r.map(x=>x.kinds)));
console.log('\n=== 系統觸發率 ===');
const has=(re)=>Math.round(r.filter(x=>re.test(x.lineSet.join('|')+x.titleSet.join('|'))).length/r.length*100);
[['大名昇格達成',/【大名昇格】|即為大名|昇格於/],['國戰',/國戰/],['討取敵將',/討取/],['包圍網',/包圍網/],['趁虛而來',/趁虛/],
 ['風聞',/兵鋒指向/],['AI併吞戰',/攻滅|於境上|攻.*不克/],['AI築城',/城砦竣工/],['AI同盟',/攻守之盟/],
 ['謀反',/謀反/],['猜忌',/眼神變了/],['名將登門',/浪客來訪/],['名將婉拒',/名望未孚/],['兵種開眼',/開眼|不擅解除|易位/],
 ['一揆',/一揆/],['側室',/側室/],['女當主',/女當主|女子之身/],['人質',/人質/],['家訓違背',/違背家訓/],['真・天下統一',/【天下統一】|天下人】/]
].forEach(([n,re])=>console.log('  '+n.padEnd(10), has(re)+'%'));

console.log('=== 視窗風暴 ===');
console.log('  storm:', r.filter(x=>x.storm).length);
