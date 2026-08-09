const fs=require('fs'),path=require('path'),vm=require('vm');
const {doc,localStorage}=require('./shim');
const src=[...fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)][0][1];
const sb={document:doc,localStorage,console,Math,JSON,Date,performance:{now:()=>Date.now()},
 setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame:()=>0,Image:class{},
 navigator:{userAgent:'node'},alert:()=>{},confirm:()=>true,
 matchMedia:()=>({matches:false,addListener(){},addEventListener(){}}),location:{port:'5877',reload(){},replace(){}}};
sb.window=sb;sb.globalThis=sb;vm.createContext(sb);
vm.runInContext(src,sb,{filename:'game.js'});
vm.runInContext("render=function(){if(S){armySync();aptSync();}};drawMap=function(){};save=function(){};log=function(){};",sb);
const g=sb.window.__game,ev=c=>vm.runInContext(c,sb),$=id=>doc.getElementById(id);
$('modalBack').classList.add('hidden');
const hid=()=>$('modalBack').classList.contains('hidden');
const bs=()=>$('modalChoices').querySelectorAll('button');
let SEED=4242; const rnd=()=>{SEED=(SEED*1664525+1013904223)>>>0;return SEED/4294967296;};
sb.Math=Object.create(Math);sb.Math.random=rnd;vm.runInContext("Math=this.Math;",sb);
const U=['ashigaru','yumi','kiba','teppo'];
const MIX={'純槍':{ashigaru:1},'純弓':{yumi:1},'純騎':{kiba:1},'純砲':{teppo:1},
 '弓砲':{yumi:.5,teppo:.5},'均衡':{ashigaru:.45,yumi:.25,kiba:.18,teppo:.12},'槍騎':{ashigaru:.55,kiba:.45}};
function army(n,m){const p=MIX[m],a={ashigaru:0,yumi:0,kiba:0,teppo:0};let acc=0;
 U.forEach((k,i)=>{if(i<3){a[k]=Math.round(n*(p[k]||0));acc+=a[k];}});a.teppo=Math.max(0,n-acc);
 if(!p.teppo&&p.teppo!==undefined){} return a;}
function battle(o){
  $('modalBack').classList.add('hidden'); ev('modalQueue.length=0');
  g.startGame(g.newState('攻',0,'kokujin','gozoku'));
  let gd=0; while(!hid()&&gd++<20){const b=bs(); if(!b.length){$('modalBack').classList.add('hidden');break;} b[0].click();}
  const S=g.S; S.kokudaka=3000;S.money=5000;S.rice=9000;S.prestige=60;S.fort=o.myFort||0;
  const L=S.retainers[1]; L.bu=60;L.chi=60;L.apt='ashigaru';L.wapt=null;L.sick=0;L.stamina=100;L.trait=null;
  S.retainers.forEach(r=>{r.loyalty=75;r.sick=0;r.stamina=100;});
  S.taishoId=L.name;
  S.army=army(o.myN,o.myMix); S.soldiers=o.myN;
  let res=null;
  const fa=army(o.foeN,o.foeMix), foeInit=o.foeN;
  g.startBattle({title:'T',intro:'',sent:{...S.army},terrain:'plain',weather:'clear',
    isSiege:o.siege,defendSiege:o.defend,
    foe:{name:'敵',army:fa,morale:80,fort:o.foeFort||0,general:{bu:60,chi:55}},onEnd:r=>{res=r;}});
  if(!hid()) bs()[o.form??2].click();
  let gu=0;
  while(!hid()&&gu++<30){const b=bs(); if(b.length===1){b[0].click();continue;} if(b.length!==4){b[0].click();continue;}
    const ci = typeof o.cmdSeq==='function' ? o.cmdSeq(gu) : (o.cmd??1); b[ci].click();}
  return res ? {win:res.win, myLost:res.myLost, foeLost:Math.round(res.foeLossRatio*foeInit),
    ratio:+(res.myLost/Math.max(1,res.foeLossRatio*foeInit)).toFixed(2)} : null;
}
function avg(o,n=200){ let w=0,ml=0,fl=0,cnt=0;
  for(let i=0;i<n;i++){const r=battle(o); if(!r)continue; cnt++; if(r.win)w++; ml+=r.myLost; fl+=r.foeLost;}
  return {勝率:Math.round(w/cnt*100)+'%', 我損:Math.round(ml/cnt), 敵損:Math.round(fl/cnt),
    交換比:+(ml/Math.max(1,fl)).toFixed(2)};
}
console.log('攻方 600 兵(均衡),守方 200 兵,城砦 3 級 —— 「交換比」= 我損/敵損,越高代表攻方越吃虧\n');
console.log('守方編成    ┃      野戰(無城)       ┃      攻城(城砦3級)');
console.log('           ┃ 勝率  我損 敵損 交換比 ┃ 勝率  我損 敵損 交換比');
['純槍','純騎','純弓','純砲','弓砲','均衡'].forEach(fm=>{
  const f=avg({myN:600,myMix:'均衡',foeN:200,foeMix:fm,siege:false,foeFort:0});
  const s=avg({myN:600,myMix:'均衡',foeN:200,foeMix:fm,siege:true,foeFort:3,cmdSeq:n=>(n===1?0:n===2?1:2)});
  console.log(`  ${fm.padEnd(8)} ┃ ${String(f.勝率).padStart(4)} ${String(f.我損).padStart(5)}${String(f.敵損).padStart(5)}${String(f.交換比).padStart(6)} ┃ ${String(s.勝率).padStart(4)} ${String(s.我損).padStart(5)}${String(s.敵損).padStart(5)}${String(s.交換比).padStart(6)}`);
});
console.log('\n城砦等級對攻方的影響(守方均衡 200 兵):');
[0,1,3,5].forEach(lv=>{ const r=avg({myN:600,myMix:'均衡',foeN:200,foeMix:'均衡',siege:lv>0,foeFort:lv,cmdSeq:n=>(n===1?0:n===2?1:2)});
  console.log('  城砦 '+lv+' 級: 勝率 '+r.勝率+'  我損 '+r.我損+'  敵損 '+r.敵損+'  交換比 '+r.交換比); });

// ── 攻城指令序列:0=鐵砲射掛け 1=土塁仕寄 2=乘り崩し 3=火矢 ──
const SEQ = {
  '一律強攻':      () => 2,
  '仕寄→強攻':     n => (n<=1 ? 1 : 2),
  '射掛→仕寄→強攻': n => (n===1?0 : n===2?1 : 2),
  '火矢→仕寄→強攻': n => (n===1?3 : n===2?1 : 2),
  '全程仕寄':      () => 1
};
console.log('\n════ 攻城打法比較(攻 300 / 守 200 均衡 / 城砦 3 級)════');
Object.entries(SEQ).forEach(([n,f])=>{
  const r=avg({myN:300,myMix:'均衡',foeN:200,foeMix:'均衡',siege:true,foeFort:3,cmdSeq:f});
  console.log('  '+n.padEnd(14), '勝率',String(r.勝率).padStart(4), ' 我損',String(r.我損).padStart(4), ' 敵損',String(r.敵損).padStart(4), ' 交換比',r.交換比);
});
console.log('\n════ 需要多少兵力才攻得下?(守 200 均衡,最佳打法 射掛→仕寄→強攻)════');
[1,1.5,2,2.5,3,4].forEach(x=>{
  const r=avg({myN:Math.round(200*x),myMix:'均衡',foeN:200,foeMix:'均衡',siege:true,foeFort:3,cmdSeq:SEQ['射掛→仕寄→強攻']});
  console.log('  兵力比 '+x+':1  勝率 '+String(r.勝率).padStart(4)+'  我損 '+String(r.我損).padStart(4)+'  交換比 '+r.交換比);
});
console.log('\n════ 攻城該帶什麼兵?(攻 600 / 守 200 均衡 / 城砦 3 級)════');
['純槍','純弓','純砲','均衡','槍騎'].forEach(m=>{
  const r=avg({myN:600,myMix:m,foeN:200,foeMix:'均衡',siege:true,foeFort:3,cmdSeq:SEQ['射掛→仕寄→強攻']});
  console.log('  '+m.padEnd(5), '勝率',String(r.勝率).padStart(4), ' 我損',String(r.我損).padStart(4), ' 交換比',r.交換比);
});
console.log('\n════ 守城該留什麼兵?(攻 600 均衡 / 守 200 / 城砦 3 級)════');
['純槍','純弓','純砲','純騎','弓砲','均衡'].forEach(m=>{
  const r=avg({myN:600,myMix:'均衡',foeN:200,foeMix:m,siege:true,foeFort:3,cmdSeq:SEQ['射掛→仕寄→強攻']});
  console.log('  '+m.padEnd(5), '攻方勝率',String(r.勝率).padStart(4), ' 攻方損失',String(r.我損).padStart(4), ' 交換比',r.交換比);
});

console.log('\n════ 兵力比梯度(守 200 均衡・城砦3級)════');
[1.8,2.0,2.2,2.4,2.6,2.8,3.0].forEach(x=>{
  const r=avg({myN:Math.round(200*x),myMix:'均衡',foeN:200,foeMix:'均衡',siege:true,foeFort:3,cmdSeq:SEQ['射掛→仕寄→強攻']},120);
  console.log('  '+x+':1 → 勝率 '+String(r.勝率).padStart(4));
});
console.log('\n════ 打法比較(攻 600 / 守 200 均衡 / 城砦 3 級)════');
Object.entries(SEQ).forEach(([n,f])=>{
  const r=avg({myN:600,myMix:'均衡',foeN:200,foeMix:'均衡',siege:true,foeFort:3,cmdSeq:f},150);
  console.log('  '+n.padEnd(14),'勝率',String(r.勝率).padStart(4),' 我損',String(r.我損).padStart(4),' 交換比',r.交換比);
});
console.log('\n════ 玩家籠城:AI 來攻打得下嗎?(我 200 守 / 敵 600 攻)════');
['純砲','弓砲','均衡','純騎'].forEach(m=>{
  [0,2,3,5].forEach(lv=>{
    const r=avg({myN:200,myMix:m,foeN:600,foeMix:'均衡',defend:true,myFort:lv,cmd:2},120);
    if(m==='均衡'||lv===3) console.log('  我方'+m.padEnd(4)+'城砦'+lv+'級 → 我守住的機率 '+String(r.勝率).padStart(4)+' 我損 '+String(r.我損).padStart(4)+' 敵損 '+String(r.敵損).padStart(4));
  });
});
