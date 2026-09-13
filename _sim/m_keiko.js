'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const {doc, localStorage} = require('./shim');
const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const script=[...HTML.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1])[0];
const sb={document:doc,localStorage,console,Math,JSON,Date,performance:{now:()=>0},
  setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},
  requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},Image:class{set src(v){}},
  navigator:{userAgent:'node'},alert:()=>{},confirm:()=>true,prompt:()=>null,
  matchMedia:()=>({matches:false,addListener(){},addEventListener(){}}),
  location:{port:'5877',reload(){},replace(){}}};
sb.window=sb;sb.globalThis=sb;vm.createContext(sb);
vm.runInContext(script,sb,{filename:'game.js'});
vm.runInContext('render=function(){};drawMap=function(){};save=function(){};',sb);
const ev=c=>vm.runInContext(c,sb); const g=sb.window.__game;
console.log('BUILD:', ev('BUILD'));
// 只包一次,否則每局重包會自我遞迴
ev(`__src={fushin:0,drill:0,trade:0,other:0};
    (function(){ const kg = keikoGain;
      keikoGain = function(r,amt){ const t = r && r.task;
        __src[t==='fushin'?'fushin':t==='drill'?'drill':t==='trade'?'trade':'other'] += amt;
        return kg(r,amt); }; })();`);

const BASE={};
function trial(mode){
  const out=[];
  for(let i=0;i<60;i++){
    g.startGame(g.newState('修'+i,i,'kokujin','gozoku','mikawa'));
    ev("modalQueue.length=0; $('modalBack').classList.add('hidden');");
    if(mode==='push') ev("S.retainers.forEach((r,k)=>{ if(k>0) r.task='fushin'; });");
    ev("__src={fushin:0,drill:0,trade:0,other:0};");
    let s=0,cap=0;
    while(s<240 && ev('S.gameOver')!==true){
      ev("S.money=Math.max(S.money,200); S.retainers.forEach(r=>{r.stamina=100;r.sick=0;}); resolveTasks(); modalQueue.length=0;");
      s++;
      if(ev('skCapLeft()')<=0){ cap=s; break; }
    }
    out.push({cap:cap||9999, pt:ev('skTotalLv()+skPt()'), yr:ev('S.year'), s});
  }
  const med=k=>{const a=out.map(o=>o[k]).sort((x,y)=>x-y);return a[30];};
  const hit=out.filter(o=>o.cap<9999);
  const tot=['fushin','drill','trade','other'].map(k=>ev('__src')[k]-(BASE[k]||0));
  ['fushin','drill','trade','other'].forEach(k=>BASE[k]=ev('__src')[k]);
  const sum=tot.reduce((a,b)=>a+b,0)||1;
  console.log('\n【'+mode+'】');
  console.log('  滿 30 點   '+hit.length+'/60 局');
  if(hit.length){
    const h=hit.map(o=>o.cap).sort((a,b)=>a-b);
    console.log('  中位       '+h[Math.floor(h.length/2)]+' 季 ≈ '+(h[Math.floor(h.length/2)]/4).toFixed(1)+' 年後即已練滿');
    console.log('  最快/最慢  '+h[0]+' / '+h[h.length-1]+' 季');
  }
  const P=out.map(o=>o.pt).sort((a,b)=>a-b);
  console.log('  最終點數   中位 '+P[30]+'/30  (最低 '+P[0]+' 最高 '+P[P.length-1]+')');
  console.log('  跑了       中位 '+out.map(o=>o.s).sort((a,b)=>a-b)[30]+' 季');
  console.log('  來源佔比   精進 '+(tot[0]/sum*100).toFixed(0)+'%  練兵 '+(tot[1]/sum*100).toFixed(0)
              +'%  經商 '+(tot[2]/sum*100).toFixed(0)+'%  其他 '+(tot[3]/sum*100).toFixed(0)+'%');
}
trial('放著不管:家臣照預設任務過日子,沒人被指派精進');
trial('push');
