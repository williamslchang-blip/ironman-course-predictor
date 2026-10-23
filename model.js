(function(root){
  'use strict';
  const distances={226:{swim:3.8,bike:180,run:42.195},113:{swim:1.9,bike:90,run:21.0975}};
  const sports=['swim','bike','run'];
  const powers={swim:1.03,bike:1.05,run:1.10};
  function parseTime(value){
    if(typeof value!=='string'||!/^\d{1,3}:\d{2}(?::\d{2})?$/.test(value.trim()))return NaN;
    const parts=value.trim().split(':').map(Number);
    if(parts.slice(1).some(v=>v>59))return NaN;
    return parts.length===3?parts[0]*3600+parts[1]*60+parts[2]:parts[0]*60+parts[1];
  }
  function formatTime(seconds){
    if(!Number.isFinite(seconds)||seconds<0)return '—';
    const n=Math.round(seconds);return [Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(v=>String(v).padStart(2,'0')).join(':');
  }
  function predict(data){
    const limits={swim:[.2,10],bike:[5,400],run:[1,100]};
    if(!distances[data.referenceDistance]||!distances[data.targetDistance])throw new Error('請選擇有效的參考與目標距離。');
    for(const key of [...sports,'t1','t2']){
      if(!Number.isFinite(data.times[key])||data.times[key]<(sports.includes(key)?1:0)||data.times[key]>172800)throw new Error('分段時間無效；每段需介於 0～48 小時，三項運動不可為零。');
    }
    for(const sport of sports){const d=data.lengths[sport];if(!Number.isFinite(d)||d<limits[sport][0]||d>limits[sport][1])throw new Error('目標距離超出可用範圍。');}
    for(const condition of [data.reference,data.target]){
      for(const [key,min,max] of [['bikeClimb',0,10000],['runClimb',0,5000],['wind',0,50],['temperature',0,45],['waves',0,2]]){
        if(!Number.isFinite(condition[key])||condition[key]<min||condition[key]>max)throw new Error('賽道或環境資料不在允許範圍內。');
      }
    }
    if(!Number.isFinite(data.spread)||data.spread<1||data.spread>15)throw new Error('情境幅度需為 1～15%。');
    const ratios={},base={},neutral={t1:data.times.t1,t2:data.times.t2};
    const warnings=[];
    for(const sport of sports){ratios[sport]=data.lengths[sport]/distances[data.referenceDistance][sport];base[sport]=data.times[sport]*Math.pow(ratios[sport],powers[sport]);}
    const a=data.reference,b=data.target;
    const bikeClimbDiff=b.bikeClimb-a.bikeClimb*ratios.bike;
    const runClimbDiff=b.runClimb-a.runClimb*ratios.run;
    neutral.swim=base.swim*Math.exp(.035*(b.waves-a.waves));
    neutral.bike=base.bike*Math.exp(.00012*(b.wind*b.wind-a.wind*a.wind)+.002*(Math.max(b.temperature-25,0)-Math.max(a.temperature-25,0)))+.9*bikeClimbDiff;
    neutral.run=base.run*Math.exp(.009*(Math.max(b.temperature-18,0)-Math.max(a.temperature-18,0)))+.75*runClimbDiff;
    for(const sport of ['bike','run']){
      const capped=Math.min(base[sport]*2.5,Math.max(base[sport]*.6,neutral[sport]));
      if(capped!==neutral[sport])warnings.push((sport==='bike'?'自行車':'跑步')+'調整已碰到模型邊界；此賽道差異過大，結果可信度偏低。');
      neutral[sport]=capped;
    }
    if(data.referenceDistance!==data.targetDistance)warnings.push('本次跨 113／226 公里推估採用假設的耐力係數，未衡量你的長距離準備；請將結果視為探索情境。');
    if(b.temperature>=30)warnings.push('目標氣溫達 30°C 以上：此模型只用單一氣溫，未納入濕度、曝曬與熱適應，炎熱條件的不確定性更高。');
    if(b.wind>=25)warnings.push('風速達 25 km/h 以上：模型未辨識側風、陣風或遮蔽，請另查該屆賽事公告與風況。');
    const scenarios={};const weights={swim:.8,bike:1,run:1.4,t1:0,t2:0};
    for(const [name,sign] of [['optimistic',-1],['neutral',0],['conservative',1]]){
      const result={};for(const sport of [...sports,'t1','t2'])result[sport]=Math.round(neutral[sport]*(1+sign*data.spread/100*weights[sport]));
      result.total=[...sports,'t1','t2'].reduce((sum,k)=>sum+result[k],0);scenarios[name]=result;
    }
    return {scenarios,base,neutral,ratios,impacts:Object.fromEntries(sports.map(s=>[s,neutral[s]-base[s]])),bikeClimbDiff,runClimbDiff,warnings};
  }
  const api={distances,parseTime,formatTime,predict};root.RaceModel=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
