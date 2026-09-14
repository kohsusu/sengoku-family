#!/bin/sh
# 家中經費兩槓桿的反解:每組看 吸收率(首末十年) / 無外力時終局錢 / 早期拮据度 / 升格石高
printf "%-12s %7s %7s %10s %8s %7s %7s %6s\n" "sol,chi" "吸收0" "吸收60" "終局錢*" "拮据早%" "石高" "升格" "斷絕"
for E in "999999,400" "12000,250" "9000,180" "7000,150" "5000,120" "4000,100"; do
  A=$(MONEY=1 ECON=$E node run.js 30 2>/dev/null | sed -n '/分岔/,/錢從哪來/p' \
      | awk '/^   0~9/{a=$NF} /^  60~69/{b=$NF} END{print a" "b}')
  NOKUGE=1 ECON=$E node run.js 30 >/dev/null 2>&1
  R=$(node -e "
    const R=require('./runs.json');const m=a=>{const b=[...a].sort((x,y)=>x-y);return b[Math.floor(b.length/2)]||0;};
    let e=0,t=0; R.forEach(r=>(r.mCurve||[]).forEach(([y,v])=>{ if(y-1545<20){t++; if(v<20)e++;} }));
    console.log([m(R.map(r=>r.money||0)), (e/(t||1)*100).toFixed(0)+'%', m(R.map(r=>r.koku||0)),
      R.filter(r=>r.daimyo).length+'/30', R.filter(r=>r.over&&r.year<1615).length].join(' '));")
  printf "%-12s %7s %7s %10s %8s %7s %7s %6s\n" "$E" $A $R
done
