const {field:F, koku:K} = require('./wars.json');
const pct = (a,b)=> b ? Math.round(a/b*100) : 0;
const wr = arr => arr.length ? Math.round(arr.filter(x=>x.win).length/arr.length*100) : null;
const avg = arr => arr.length ? +(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(2) : 0;
const by = (arr, key) => { const m={}; arr.forEach(x=>{ const k=typeof key==='function'?key(x):x[key]; (m[k]=m[k]||[]).push(x); }); return m; };
function table(title, arr, key, extra){
  console.log('\n=== '+title+' ===');
  const m = by(arr, key);
  const rows = Object.entries(m).map(([k,v])=>({k, n:v.length, w:wr(v), v}));
  rows.sort((a,b)=>b.w-a.w);
  rows.forEach(r=>{
    let s = '  '+String(r.k).padEnd(12)+String(r.n).padStart(4)+'場  勝率 '+String(r.w).padStart(3)+'%';
    if(extra) s += '  '+extra(r.v);
    console.log(s);
  });
}
const FN={gyorin:'魚鱗',kakuyoku:'鶴翼',hoen:'方圓',gankou:'雁行'};
const TN={plain:'平野',mountain:'山地',river:'河畔'};
const WN={clear:'晴',rain:'雨',fog:'霧'};

console.log('════════ A. 野戰/攻城(五陣引擎) n='+F.length+' ════════');
console.log('整體勝率', wr(F)+'%  | 平均回合', avg(F.map(x=>x.rounds)),
  '| 我方崩潰', pct(F.filter(x=>x.brokeMy).length,F.length)+'%',
  '| 敵方崩潰', pct(F.filter(x=>x.brokeFoe).length,F.length)+'%');

table('兵力比(我/敵)', F, 'ratio', v=>'我損中位 '+avg(v.map(x=>x.myLost)));
table('指令方針', F, 'policy', v=>'敵損率 '+avg(v.map(x=>x.foeLoss)));
table('陣形', F, x=>FN[x.form]);
table('我方編成', F, 'myMix', v=>'敵損率 '+avg(v.map(x=>x.foeLoss)));
table('敵方編成(我對上誰)', F, 'foeMix');
table('大將武勇', F, 'bu');
table('適性佔比(該將專精兵在我軍中的比例)', F, x=>x.aptShare>=0.9?'0.9-1.0':x.aptShare>=0.6?'0.6-0.9':x.aptShare>=0.3?'0.3-0.6':x.aptShare>=0.1?'0.1-0.3':'0-0.1');
table('地形', F, x=>TN[x.terrain]);
table('天候', F, x=>WN[x.weather]);
table('忠誠', F, 'loyalty');
table('威望', F, 'prestige');
table('戰況', F, x=> x.siege?'攻城(敵有城砦)' : x.defend?'籠城(我有城砦)' : '野戰');

console.log('\n── 相剋是否真的有效(只看兵力比 0.85~1.2 的對局) ──');
const even = F.filter(x=>x.ratio>=0.85 && x.ratio<=1.2);
const pairs = {};
even.forEach(x=>{ const k=x.myMix+' vs '+x.foeMix; (pairs[k]=pairs[k]||[]).push(x); });
Object.entries(pairs).filter(([,v])=>v.length>=4).map(([k,v])=>({k,n:v.length,w:wr(v)}))
  .sort((a,b)=>b.w-a.w).slice(0,8).forEach(r=>console.log('  最強 '+r.k.padEnd(24), r.w+'%', '('+r.n+'場)'));
Object.entries(pairs).filter(([,v])=>v.length>=4).map(([k,v])=>({k,n:v.length,w:wr(v)}))
  .sort((a,b)=>a.w-b.w).slice(0,8).forEach(r=>console.log('  最弱 '+r.k.padEnd(24), r.w+'%', '('+r.n+'場)'));

console.log('\n════════ B. 大名國戰(七陣・備制) n='+K.length+' ════════');
console.log('整體勝率', wr(K)+'%  | 平均討取', avg(K.map(x=>x.slain)));
table('兵力(我)', K, 'myN', v=>'敵兵中位 '+avg(v.map(x=>x.foeN)));
table('攻守', K, x=>x.attack?'我攻':'我守');
table('布陣', K, 'layout', v=>'我損 '+avg(v.map(x=>x.lost)));
table('采配', K, x=>({none:'不下采配',totsu:'突出',taiki:'後退整隊',ukai:'迂迴'}[x.sai]));
table('指令方針', K, 'policy');
table('我方編成', K, 'myMix', v=>'討取 '+avg(v.map(x=>x.slain)));
table('大將武勇', K, 'bu');
table('城砦(守方)', K.filter(x=>!x.attack), 'myFort');
table('敵直轄領', K, 'foeDemesne', v=>'敵兵 '+avg(v.map(x=>x.foeN)));
console.log('\n討取分佈:', JSON.stringify(K.reduce((m,x)=>{m[x.slain]=(m[x.slain]||0)+1;return m;},{})));
