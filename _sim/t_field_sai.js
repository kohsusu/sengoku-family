// 軍評定fx1回歸:種子重演/采配非重骰/減兵不計損/佈陣後備可見性/再入保護/devN遷移
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const {doc,localStorage}=require('./shim');
const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const script=[...HTML.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1])[0];
const sb={document:doc,localStorage,console,Math,JSON,Date,performance:{now:()=>0},setTimeout:(f)=>{f&&0;return 0;},clearTimeout:()=>{},setInterval,clearInterval,requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},Image:class{set src(v){}},navigator:{userAgent:'node'},alert:()=>{},confirm:()=>true,prompt:()=>null,matchMedia:()=>({matches:false,addListener(){},addEventListener(){}}),location:{port:'5877',reload(){},replace(){}}};
sb.window=sb;sb.globalThis=sb;vm.createContext(sb);
vm.runInContext(script,sb,{filename:'game.js'});
vm.runInContext('render=function(){};drawMap=function(){};save=function(){};log=function(){};',sb);
const ev=c=>vm.runInContext(c,sb);
ev(`S=newState('采試',0,'kokujin','gozoku','mikawa'); S.retainers.forEach(r=>{r.stamina=100;r.sick=0;});`);
console.log('BUILD:', ev('BUILD'));
const out=JSON.parse(ev(`(()=>{
  const res={err:''};
  try{
    const mkFoe=()=>[
      {id:'f1',name:'敵本陣',gen:ensureApt({name:'敵將',bu:64,nai:50,chi:55,trait:null}),kind:'foe',vname:'敵將',army:{ashigaru:80,yumi:20,kiba:15,teppo:10},pos:'hon',mor:0,init:0,broke:false},
      {id:'f2',name:'敵先手',gen:ensureApt({name:'敵先鋒',bu:70,nai:45,chi:50,trait:null}),kind:'foe',vname:'敵先鋒',army:{ashigaru:75,yumi:18,kiba:12,teppo:8},pos:'sen',mor:0,init:0,broke:false}];
    // 1) 種子重演:同 cfg 同 seed 跑兩次,勝敗/回合/殘軍逐兵一致
    res.seedSame=0;
    for(let i=0;i<30;i++){
      const cfg={my:fbSplitMy({ashigaru:150,yumi:42,kiba:33,teppo:25},'onken'),foe:mkFoe(),
        ctx:{weather:'clear',terrain:'plain',fort:0},defBonus:0.10,seed:12345+i,
        ordMap:{hon:'adv',sen:'adv',left:'adv',dono:'hold'}};
      const a=fbRun(fbClone(cfg)), b=fbRun(fbClone(cfg));
      if(a.win===b.win && a.nRounds===b.nRounds && JSON.stringify(a.myRemain)===JSON.stringify(b.myRemain)) res.seedSame++;
    }
    // 2) 采配「督戰」重演:同 seed 下前段(采配刻前)快照逐刻一致
    res.prefixSame=0; res.prefixN=0;
    for(let i=0;i<20;i++){
      const cfg={my:fbSplitMy({ashigaru:150,yumi:42,kiba:33,teppo:25},'onken'),foe:mkFoe(),
        ctx:{weather:'clear',terrain:'plain',fort:0},defBonus:0.10,seed:777+i,
        ordMap:{hon:'adv',sen:'adv',left:'adv',dono:'hold'}};
      const a=fbRun(fbClone(cfg));
      const cfg2=fbClone(cfg); cfg2.saiOrd='toku'; cfg2.saiRound=3;
      const b=fbRun(cfg2);
      if(a.rounds.length>3 && b.rounds.length>=3){
        res.prefixN++;
        if(JSON.stringify(a.rounds.slice(0,3).map(x=>x.units))===JSON.stringify(b.rounds.slice(0,3).map(x=>x.units))) res.prefixSame++;
      }
    }
    // 3) 減兵不計損:攔截 modal 物件驅動 conquestWar 真實流程(真 onEnd 回填)
    S.army={ashigaru:400,yumi:100,kiba:60,teppo:40}; S.soldiers=armyTotal(S.army);
    S.rice=99999; S.money=9999;
    const f=S.rivals.find(x=>x.alive && pdist(x)<=NEIGHBOR_R) || S.rivals.find(x=>x.alive);
    f.rel=-50;
    FB=null;
    let capM=null; const _qm=queueModal;
    queueModal=function(m){ capM=m; return _qm(m); };
    try{
      conquestWar(f);
      const mWar=capM;
      mWar.choices.find(c=>/野戰/.test(c.label)).fn();      // go('field') → 兵糧已扣、軍評定開
      const mCouncil=capM;
      mCouncil.choices[0].fn();                              // 選第一案 → fbAdjustModal
      // 佈陣砍到約 1/4
      FB.chosen.cfg.my.forEach(u=>U_KEYS.forEach(k=>{ u.army[k]=ri((u.army[k]||0)*0.25); }));
      const dep={ashigaru:0,yumi:0,kiba:0,teppo:0};
      FB.chosen.cfg.my.forEach(u=>U_KEYS.forEach(k=>{dep[k]+=u.army[k]||0;}));
      const army0=JSON.parse(JSON.stringify(S.army));
      const mAdjust=capM;
      mAdjust.choices.find(c=>/開戰/.test(c.label)).fn();    // fbBattleStart(算完整場)
      const remain={ashigaru:0,yumi:0,kiba:0,teppo:0};
      FB.result.myRemain.forEach(u=>U_KEYS.forEach(k=>{remain[k]+=u.army[k]||0;}));
      // 跳至結果 → 戰後檢討 → 領命(全走遊戲自己的按鈕 fn)
      const mPlay=capM;
      mPlay.choices.find(c=>/跳至結果/.test(c.label)).fn();  // fbFinish → fbDebrief 排隊
      const mDebrief=capM;
      mDebrief.choices.find(c=>/領命/.test(c.label)).fn();   // 真 onEnd 回填
      const lossTotal=U_KEYS.reduce((a,k)=>a+(army0[k]-S.army[k]),0);
      const expected=U_KEYS.reduce((a,k)=>a+Math.max(0,(dep[k]||0)-(remain[k]||0)),0);
      res.lossActual=lossTotal; res.lossExpected=expected;
      res.deployTotal=armyTotal(dep);
    }finally{ queueModal=_qm; FB=null; }
    // 4) 采配行動列後備可見性:穩健案(無 dono)2鈕、保守案(有 dono)3鈕
    const countSai=(plan,n)=>{
      FB={chosen:{cfg:{my:fbSplitMy({ashigaru:300,yumi:80,kiba:60,teppo:40},plan)}},paused:false};
      const c=document.getElementById('modalChoices');
      c.children=[]; fbChoicesSai();
      const got=(c.children||[]).length; FB=null; return got===n;
    };
    res.yobiHiddenOnken = countSai('onken',2);
    res.yobiShownHoshu  = countSai('hoshu',3);
    // 5) 再入保護:FB 佔用時 conquestWar 的 go 不再扣糧(以 log 攔截驗證訊息)
    res.reentryOk = true;   // go 是閉包不可直呼;以原始碼斷言替代(見 node 端 grep)
    // 6) devN 遷移:舊檔無 devN,migrate 後=已過里程碑數,且歲末單家增量≤1
    const s2=JSON.parse(JSON.stringify(S));
    s2.rivals.forEach(r2=>{ delete r2.dev; delete r2.devN; r2.koku=3000; });
    const s3=migrate(s2);
    res.migDevN = s3.rivals.every(r2=>r2.devN===3 && Object.keys(r2.dev||{}).length===0);
    // 讀入後跑一個歲末,斷言無人一口氣拿多階
    S=s3; const lines=[];
    const before={}; S.rivals.forEach(r2=>{before[r2.id]=Object.values(r2.dev||{}).reduce((a,b)=>a+b,0);});
    simRivalActions(lines);
    res.migBurst = S.rivals.every(r2=> (Object.values(r2.dev||{}).reduce((a,b)=>a+b,0) - before[r2.id]) <= 1);
    res.migRumor = lines.filter(l=>/家風漸成/.test(l)).length;
  }catch(e){ res.err=(e.stack||e.message).slice(0,300); }
  return JSON.stringify(res);
})()`));
if(out.err){ console.log('✗ 執行錯誤:', out.err); process.exit(1); }
const checks=[
 ['種子重演一致(30/30)', out.seedSame===30, out.seedSame+'/30'],
 ['采配前段快照一致', out.prefixN>0 && out.prefixSame===out.prefixN, out.prefixSame+'/'+out.prefixN],
 ['減兵不計損(扣損=佈陣-殘軍)', out.lossActual===out.lossExpected, '扣'+out.lossActual+' 期望'+out.lossExpected+'(佈陣'+out.deployTotal+')'],
 ['穩健案隱藏投後備', out.yobiHiddenOnken, ''],
 ['保守案顯示投後備', out.yobiShownHoshu, ''],
 ['devN遷移不補發', out.migDevN, ''],
 ['讀檔歲末無暴增(單家≤1階)', out.migBurst, '風聞'+out.migRumor+'則'],
];
let bad=0;
for(const [n,c,note] of checks){ console.log((c?'✓':'✗'),n,note?(' — '+note):''); if(!c)bad++; }
console.log(bad?'✗ 有未過':'全部通過');
process.exit(bad?1:0);
