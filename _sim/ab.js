// 控制變因的 A/B:其餘條件全部固定,只動一項
const fs=require('fs'),path=require('path'),vm=require('vm');
const {doc,localStorage}=require('./shim');
const src=[...fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)][0][1];
const sb={document:doc,localStorage,console,Math,JSON,Date,performance:{now:()=>Date.now()},
 setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame:()=>0,Image:class{},
 navigator:{userAgent:'node'},alert:()=>{},confirm:()=>true,
 matchMedia:()=>({matches:false,addListener(){},addEventListener(){}}),location:{port:'5877',reload(){},replace(){}}};
sb.window=sb; sb.globalThis=sb; vm.createContext(sb);
vm.runInContext(src,sb,{filename:'game.js'});
vm.runInContext("render=function(){if(S){armySync();aptSync();}};drawMap=function(){};save=function(){};log=function(){};",sb);
const g=sb.window.__game, ev=c=>vm.runInContext(c,sb), $=id=>doc.getElementById(id);
$('modalBack').classList.add('hidden');
const hid=()=>$('modalBack').classList.contains('hidden');
const bs=()=>$('modalChoices').querySelectorAll('button');
let SEED=777; const rnd=()=>{SEED=(SEED*1664525+1013904223)>>>0;return SEED/4294967296;};
sb.Math=Object.create(Math); sb.Math.random=rnd; vm.runInContext("Math=this.Math;",sb);

function battle(o){
  $('modalBack').classList.add('hidden'); ev('modalQueue.length=0');
  g.startGame(g.newState('AB',0,'kokujin','gozoku'));
  let gd=0; while(!hid()&&gd++<20){const b=bs(); if(!b.length){$('modalBack').classList.add('hidden');break;} b[0].click();}
  const S=g.S;
  S.kokudaka=3000; S.money=5000; S.rice=9000; S.prestige=o.prestige??60;
  const L=S.retainers[1];
  L.bu=o.bu; L.chi=60; L.apt=o.apt; L.apt2=null; L.wapt=o.wapt||null; L.sick=0; L.stamina=100; L.trait=null;
  S.retainers.forEach(r=>{r.loyalty=75;r.sick=0;r.stamina=100;});
  S.taishoId=L.name;
  S.army={ashigaru:0,yumi:0,kiba:0,teppo:0}; S.army[o.myUnit]=200; S.soldiers=200;
  let res=null;
  const fa={ashigaru:0,yumi:0,kiba:0,teppo:0}; fa[o.foeUnit]=200;
  g.startBattle({title:'AB',intro:'',sent:{...S.army},terrain:'plain',weather:'clear',
    foe:{name:'敵',army:fa,morale:80,general:{bu:o.foeBu??60,chi:55}},onEnd:r=>{res=r;}});
  if(!hid()) bs()[o.form??2].click();
  let gu=0;
  while(!hid()&&gu++<30){const b=bs(); if(b.length===1){b[0].click();continue;} if(b.length!==4){b[0].click();continue;} b[o.cmd??1].click();}
  return res;
}
const N=300;
function run(mk){ let w=0; for(let i=0;i<N;i++){ const r=battle(mk(i)); if(r&&r.win) w++; } return Math.round(w/N*100); }

console.log('=== ⓪ 真正對等時的勝率(我方無適性加成、無威望、指令與敵同為隨機) ===');
{ let w=0; const N2=400;
  for(let i=0;i<N2;i++){
    const r=battle({bu:60,apt:'yumi',wapt:null,myUnit:'ashigaru',foeUnit:'ashigaru',prestige:0,
                    cmd:Math.floor(rnd()*4),foeBu:60});
    if(r&&r.win) w++;
  }
  console.log('  對等勝率', Math.round(w/N2*100)+'%  (理想值 ~50%)');
}
console.log('');
console.log('=== ① 兵種適性:同一支純騎軍,大將專精不同(武勇固定 60) ===');
[['馬術專精(合)','kiba',null],['槍術(不合)','ashigaru',null],['槍術且不擅馬術','ashigaru','kiba']].forEach(([n,apt,wapt])=>{
  console.log('  '+n.padEnd(16), run(()=>({bu:60,apt,wapt,myUnit:'kiba',foeUnit:'kiba'}))+'%');
});
console.log('\n=== ② 大將武勇(適性固定相合,純槍對純槍) ===');
[30,45,60,75,88].forEach(bu=>console.log('  武勇 '+String(bu).padEnd(4), run(()=>({bu,apt:'ashigaru',myUnit:'ashigaru',foeUnit:'ashigaru'}))+'%'));
console.log('\n=== ③ 兵種相剋(等量對決,大將武勇 60 且適性相合,一律突擊) ===');
const U=['ashigaru','yumi','kiba','teppo'], NM={ashigaru:'槍',yumi:'弓',kiba:'騎',teppo:'砲'};
console.log('     對手→   '+U.map(k=>NM[k].padStart(5)).join(''));
U.forEach(a=>{
  const row=U.map(d=>String(run(()=>({bu:60,apt:a,myUnit:a,foeUnit:d}))).padStart(5));
  console.log('  我方 '+NM[a]+'    '+row.join(''));
});
