// 軍評定P1:fbRun無頭核心——200場終止/勝負分佈/全域還原/無洩漏
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const {doc,localStorage}=require('./shim');
const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const script=[...HTML.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1])[0];
const sb={document:doc,localStorage,console,Math,JSON,Date,performance:{now:()=>0},setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},Image:class{set src(v){}},navigator:{userAgent:'node'},alert:()=>{},confirm:()=>true,prompt:()=>null,matchMedia:()=>({matches:false,addListener(){},addEventListener(){}}),location:{port:'5877',reload(){},replace(){}}};
sb.window=sb;sb.globalThis=sb;vm.createContext(sb);
vm.runInContext(script,sb,{filename:'game.js'});
vm.runInContext('render=function(){};drawMap=function(){};save=function(){};log=function(){};',sb);
const ev=c=>vm.runInContext(c,sb);
ev(`S=newState('野試',0,'kokujin','gozoku','mikawa');`);
console.log('BUILD:', ev('BUILD'));
const out=JSON.parse(ev(`(()=>{
  const res={n:0,win:0,rounds:0,maxR:0,err:'',evSum:0};
  const KS0=KS, BT0=BT, mq=(typeof modalQueue!=='undefined')?modalQueue.length:0;
  for(let i=0;i<200;i++){
    const ter=['plain','mountain','river'][i%3];
    const cfg={
      my:[{id:'m1',name:'我本陣',gen:ensureApt({name:'我將',bu:62,nai:50,chi:55,trait:null}),kind:'family',army:{ashigaru:70,yumi:20,kiba:15,teppo:10},pos:'hon',mor:0,init:0,broke:false},
          {id:'m2',name:'我先手',gen:ensureApt({name:'先手將',bu:75,nai:45,chi:50,trait:null}),kind:'family',army:{ashigaru:90,yumi:20,kiba:15,teppo:10},pos:'sen',mor:0,init:0,broke:false}],
      foe:[{id:'f1',name:'敵本陣',gen:ensureApt({name:'敵將',bu:64,nai:50,chi:55,trait:null}),kind:'foe',vname:'敵將',army:{ashigaru:80,yumi:20,kiba:15,teppo:10},pos:'hon',mor:0,init:0,broke:false},
           {id:'f2',name:'敵先手',gen:ensureApt({name:'敵先鋒',bu:70,nai:45,chi:50,trait:null}),kind:'foe',vname:'敵先鋒',army:{ashigaru:75,yumi:18,kiba:12,teppo:8},pos:'sen',mor:0,init:0,broke:false}],
      ctx:{weather:'sunny',terrain:ter,fort:0},
      defBonus: fbDefMul(ter) - 1
    };
    try{
      const r=fbRun(cfg);
      res.n++; if(r.win)res.win++;
      res.rounds+=r.nRounds; res.maxR=Math.max(res.maxR,r.nRounds);
      res.evSum+=r.rounds.reduce((a,x)=>a+x.events.length,0);
      if(!r.rounds.length){res.err='no-rounds';break;}
      if(r.myRemain.length!==2||r.foeRemain.length!==2){res.err='remain-shape';break;}
    }catch(e){ res.err=e.message.slice(0,120); break; }
  }
  res.ksRestored = (KS===KS0) && (BT===BT0);
  res.mqLeak = ((typeof modalQueue!=='undefined')?modalQueue.length:0) - mq;
  return JSON.stringify(res);
})()`));
const checks=[
 ['200場全數完賽', out.n===200 && !out.err, out.err||''],
 ['勝率健康帶(25-75%)', out.win>=50 && out.win<=150, out.win+'/200'],
 ['回合上限10', out.maxR<=10, 'max '+out.maxR],
 ['事件流非空', out.evSum>200, out.evSum+'行'],
 ['KS/BT全域還原', out.ksRestored, ''],
 ['無modal洩漏', out.mqLeak===0, ''],
];
let bad=0;
for(const [n,c,note] of checks){ console.log((c?'✓':'✗'),n,note?(' — '+note):''); if(!c)bad++; }
console.log(bad?'✗ 有未過':'全部通過');
