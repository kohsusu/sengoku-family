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
ev(`S=newState('野試',0,'kokujin','gozoku','mikawa'); S.retainers.forEach(r=>{r.stamina=100;r.sick=0;});`);
console.log('BUILD:', ev('BUILD'));
const out=JSON.parse(ev(`(()=>{
  const res={n:0,win:0,rounds:0,maxR:0,err:'',evSum:0,emptyR:0,totR:0,fusehiHit:0,fusehiN:0};
  const KS0=KS, BT0=BT, mq=(typeof modalQueue!=='undefined')?modalQueue.length:0;
  for(let i=0;i<200;i++){
    const ter=['plain','mountain','river'][i%3];
    const cfg={
      my: fbSplitMy({ashigaru:150,yumi:42,kiba:33,teppo:25},'onken'),   // 真實流程一律經fbSplitMy(2-3備有側翼);手組2v2是退化局
      foe:[{id:'f1',name:'敵本陣',gen:ensureApt({name:'敵將',bu:64,nai:50,chi:55,trait:null}),kind:'foe',vname:'敵將',army:{ashigaru:80,yumi:20,kiba:15,teppo:10},pos:'hon',mor:0,init:0,broke:false},
           {id:'f2',name:'敵先手',gen:ensureApt({name:'敵先鋒',bu:70,nai:45,chi:50,trait:null}),kind:'foe',vname:'敵先鋒',army:{ashigaru:75,yumi:18,kiba:12,teppo:8},pos:'sen',mor:0,init:0,broke:false}],
      ctx:{weather:'sunny',terrain:ter,fort:0},
      defBonus: fbDefMul(ter) - 1,
      ordMap:{hon:'adv',sen:'adv',left:'adv',dono:'hold'}   // P3後fbRun吃軍令表;不帶=全軍按兵易被地利磨死
    };
    try{
      const r=fbRun(cfg);
      res.n++; if(r.win)res.win++;
      res.rounds+=r.nRounds; res.maxR=Math.max(res.maxR,r.nRounds);
      res.evSum+=r.rounds.reduce((a,x)=>a+x.events.length,0);
      r.rounds.slice(1).forEach(x=>{ res.totR++; if(!x.events.length) res.emptyR++; });
      if(!r.rounds.length){res.err='no-rounds';break;}
      if(r.myRemain.length!==cfg.my.length||r.foeRemain.length!==2){res.err='remain-shape';break;}
    }catch(e){ res.err=e.message.slice(0,120); break; }
  }
  // 伏兵敘事線:必成計略 20 場,逐刻事件流必見「伏兵」(B1 回歸)
  for(let i=0;i<20;i++){
    const cfg={ my: fbSplitMy({ashigaru:150,yumi:42,kiba:33,teppo:25},'onken'),
      foe:[{id:'f1',name:'敵本陣',gen:ensureApt({name:'敵將',bu:64,nai:50,chi:55,trait:null}),kind:'foe',vname:'敵將',army:{ashigaru:80,yumi:20,kiba:15,teppo:10},pos:'hon',mor:0,init:0,broke:false},
           {id:'f2',name:'敵先手',gen:ensureApt({name:'敵先鋒',bu:70,nai:45,chi:50,trait:null}),kind:'foe',vname:'敵先鋒',army:{ashigaru:75,yumi:18,kiba:12,teppo:8},pos:'sen',mor:0,init:0,broke:false}],
      ctx:{weather:'clear',terrain:'plain',fort:0}, defBonus:0.10,
      ordMap:{hon:'adv',sen:'adv',left:'adv',dono:'hold'}, kisaku:{type:'fusehi',p:1.0}};
    res.fusehiN++;
    if(fbRun(cfg).rounds.flatMap(x=>x.events).some(e=>/伏兵/.test(e))) res.fusehiHit++;
  }
  res.ksRestored = (KS===KS0) && (BT===BT0);
  res.mqLeak = ((typeof modalQueue!=='undefined')?modalQueue.length:0) - mq;
  return JSON.stringify(res);
})()`));
const checks=[
 ['200場全數完賽', out.n===200 && !out.err, out.err||''],
 ['勝率健康帶(20-80%·防退化)', out.win>=40 && out.win<=160, out.win+'/200'],
 ['回合上限10', out.maxR<=10, 'max '+out.maxR],
 ['事件流非空', out.evSum>200, out.evSum+'行'],
 ['KS/BT全域還原', out.ksRestored, ''],
 ['無modal洩漏', out.mqLeak===0, ''],
 ['空事件回合<15%(壞損時50%)', out.totR>0 && out.emptyR/out.totR < 0.15, ri(out.emptyR/Math.max(1,out.totR)*100)+'%('+out.emptyR+'/'+out.totR+')'],
 ['必成伏兵敘事必現', out.fusehiHit===out.fusehiN, out.fusehiHit+'/'+out.fusehiN],
];
function ri(x){ return Math.round(x); }
let bad=0;
for(const [n,c,note] of checks){ console.log((c?'✓':'✗'),n,note?(' — '+note):''); if(!c)bad++; }
console.log(bad?'✗ 有未過':'全部通過');
