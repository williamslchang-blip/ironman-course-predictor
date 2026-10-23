(function(root){
'use strict';
const distances={'51.5':{swim:1.5,bike:40,run:10},'113':{swim:1.9,bike:90,run:21.0975},'226':{swim:3.8,bike:180,run:42.195}};
const sports=['swim','bike','run'],splits=['swim','t1','bike','t2','run'],powers={swim:1.03,bike:1.05,run:1.10};
const fields=[
{key:'water',sport:'swim',label:'水域類型',options:['湖泊／水庫','海域','河道'],value:0},
{key:'waves',sport:'swim',label:'水面浪況',options:['平靜','輕浪','明顯浪況'],value:0},
{key:'current',sport:'swim',label:'整段淨水流',options:['整體順流','中性／未知','整體逆流'],value:1},
{key:'wetsuit',sport:'swim',label:'防寒衣假設',options:['未穿／未知','預計可穿且會穿'],value:0},
{key:'bikeClimb',sport:'bike',label:'自行車總爬升（m）',min:0,max:10000,step:1,value:0},
{key:'wind',sport:'bike',label:'平均風速（km/h）',min:0,max:50,step:.1,value:0},
{key:'exposure',sport:'bike',label:'路線風曝露',options:['多遮蔽','部分開闊','大部分開闊'],value:1},
{key:'technical',sport:'bike',label:'彎道與下坡技術性',options:['低：流暢路線','中：有急彎／下坡','高：密集彎道／下坡'],value:0},
{key:'surface',sport:'bike',label:'自行車路面',options:['平整鋪面','局部顛簸','較多粗糙路段'],value:0},
{key:'runClimb',sport:'run',label:'跑步總爬升（m）',min:0,max:5000,step:1,value:0},
{key:'temperature',sport:'run',label:'預計運動時段氣溫（°C）',min:0,max:45,step:.1,value:20},
{key:'humidity',sport:'run',label:'相對濕度（%）',min:0,max:100,step:1,value:50},
{key:'shade',sport:'run',label:'跑步日照曝露',options:['多數有遮蔭','部分日照','大部分曝曬'],value:1},
{key:'runSurface',sport:'run',label:'跑步路面',options:['平整硬鋪面','混合鋪面','較多非鋪面'],value:0}];
const defaultConditions=()=>Object.fromEntries(fields.map(f=>[f.key,f.value]));
function parseTime(v){if(typeof v!=='string'||!/^\d{1,3}:\d{2}(?::\d{2})?$/.test(v.trim()))return NaN;const p=v.trim().split(':').map(Number);if(p.slice(1).some(n=>n>59))return NaN;return p.length===3?p[0]*3600+p[1]*60+p[2]:p[0]*60+p[1];}
function formatTime(s){if(!Number.isFinite(s)||s<0)return '—';const n=Math.round(s);return [Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(v=>String(v).padStart(2,'0')).join(':');}
const sumTimes=t=>splits.reduce((sum,k)=>sum+t[k],0);
const heat=(c,t)=>Math.max(c.temperature-t,0)*(1+Math.max(c.humidity-50,0)/100)*(0.8+0.2*c.shade);
function validateLengths(l){for(const [s,min,max] of [['swim',.2,10],['bike',5,400],['run',1,100]])if(!Number.isFinite(l?.[s])||l[s]<min||l[s]>max)throw new Error('實際距離無效；游泳 0.2～10、自行車 5～400、跑步 1～100 km。');}
function predict(d){
if(!distances[d.referenceDistance]||!distances[d.targetDistance])throw new Error('請選擇 51.5、113 或 226 距離組別。');
if(!String(d.referenceName||'').trim()||!String(d.targetName||'').trim())throw new Error('請填寫過往與本次比賽的場次名稱，建議含年份。');
for(const s of splits)if(!Number.isFinite(d.times?.[s])||d.times[s]<(sports.includes(s)?1:0)||d.times[s]>172800)throw new Error('請填寫有效分段時間；三項運動不可為零，T1／T2 可為零。');
if(!Number.isFinite(d.officialTotal)||d.officialTotal<=0)throw new Error('請輸入過往比賽總時間，或按「以分段合計填入」。');
if(Math.abs(sumTimes(d.times)-d.officialTotal)>2)throw new Error('總時間與分段合計差超過 2 秒。請確認是否包含罰時、槍聲時間或抄錄誤差，再修正輸入。');
const refLengths=d.referenceLengths||distances[d.referenceDistance];validateLengths(refLengths);validateLengths(d.lengths);
const a={...defaultConditions(),...d.reference},b={...defaultConditions(),...d.target};
for(const c of [a,b])for(const f of fields){const v=c[f.key];if(!Number.isFinite(v)||(f.options?(!Number.isInteger(v)||v<0||v>=f.options.length):(v<f.min||v>f.max)))throw new Error('賽道條件無效：'+f.label+'。');}
if(!Number.isFinite(d.spread)||d.spread<1||d.spread>20)throw new Error('情境幅度需為 1～20%。');
const transitions=d.targetTransitions||{t1:d.times.t1,t2:d.times.t2};for(const k of ['t1','t2'])if(!Number.isFinite(transitions[k])||transitions[k]<0||transitions[k]>7200)throw new Error('本次 T1／T2 需為 0～2 小時。');
const base={},ratios={},neutral={...transitions},contributions=[],warnings=[];
for(const s of sports){ratios[s]=d.lengths[s]/refLengths[s];base[s]=d.times[s]*Math.pow(ratios[s],powers[s]);neutral[s]=base[s];}
function factor(s,key,label,delta){const before=neutral[s];neutral[s]*=Math.exp(delta);contributions.push({sport:s,key,label,seconds:neutral[s]-before});}
function add(s,key,label,seconds){neutral[s]+=seconds;contributions.push({sport:s,key,label,seconds});}
factor('swim','waves','浪況差異',.035*(b.waves-a.waves));factor('swim','current','淨水流差異',.06*(b.current-a.current));factor('swim','wetsuit','防寒衣假設',-.025*(b.wetsuit-a.wetsuit));
const exposure=[.35,.65,1];
factor('bike','wind','風速與風曝露',.00012*(b.wind**2*exposure[b.exposure]-a.wind**2*exposure[a.exposure]));
factor('bike','heat','騎乘熱負荷',.002*(heat(b,25)-heat(a,25)));
factor('bike','technical','彎道與下坡技術',.025*(b.technical-a.technical));factor('bike','surface','自行車路面',.02*(b.surface-a.surface));
const bikeClimbDiff=b.bikeClimb-a.bikeClimb*ratios.bike,runClimbDiff=b.runClimb-a.runClimb*ratios.run;
add('bike','climb','等距離校正後爬升差',.9*bikeClimbDiff);
factor('run','heat','氣溫／濕度／曝曬',.009*(heat(b,18)-heat(a,18)));factor('run','surface','跑步路面',.018*(b.runSurface-a.runSurface));add('run','climb','等距離校正後爬升差',.75*runClimbDiff);
for(const s of sports){const capped=Math.min(base[s]*2.5,Math.max(base[s]*.6,neutral[s]));if(capped!==neutral[s]){add(s,'cap','模型邊界修正',capped-neutral[s]);warnings.push(({swim:'游泳',bike:'自行車',run:'跑步'})[s]+'差異已碰到模型邊界，請降低對結果的依賴。');}}
if(String(d.referenceDistance)!==String(d.targetDistance))warnings.push('跨距離推估使用假設的耐力係數。51.5、113、226 的強度與補給需求不同，單場短距離成績無法驗證長距離耐力。');
if(String(d.referenceDistance)==='51.5'&&String(d.targetDistance)==='226')warnings.push('由 51.5 推估 226 外推幅度很大，建議補入長距離實戰資料校準；此輸出僅適合初步規劃。');
if(d.referenceEvidence!=='documented'||d.targetEvidence!=='documented')warnings.push('至少一場賽道資料仍為估計／待核對；解說與調整依目前輸入，尚非該場次實地勘查結論。');
if(b.temperature>=30)warnings.push('高溫的不確定性增加；單一平均氣溫無法代表各運動時段的實際環境。');
if(b.wind>=25)warnings.push('平均風速較高；模型未掌握風向與陣風，風速調整只能視為概略情境。');
const scenarios={},weights={swim:.8,bike:1,run:1.4,t1:0,t2:0};
for(const [name,sign] of [['optimistic',-1],['neutral',0],['conservative',1]]){const r={};for(const s of splits)r[s]=Math.round(neutral[s]*(1+sign*d.spread/100*weights[s]));r.total=sumTimes(r);scenarios[name]=r;}
const impacts=Object.fromEntries(sports.map(s=>[s,neutral[s]-base[s]])),baselineTotal=sports.reduce((sum,s)=>sum+base[s],0)+transitions.t1+transitions.t2,courseDelta=Object.values(impacts).reduce((sum,v)=>sum+v,0);
return {scenarios,base,neutral,ratios,impacts,contributions,bikeClimbDiff,runClimbDiff,baselineTotal,courseDelta,coursePercent:courseDelta/baselineTotal*100,warnings,reference:a,target:b,refLengths};
}
function courseAdvice(d,r){
const c=r.target,l=d.lengths,get=k=>fields.find(f=>f.key===k).options[c[k]];
const swim={sport:'swim',title:'游泳｜讀懂水域，穩定辨向',tags:[get('water'),get('waves'),l.swim+' km'],features:[],attention:[],strategy:[]};
swim.features.push('依輸入，本次為'+get('water')+'，距離 '+l.swim+' km。'+(c.waves?'浪況會增加換氣與維持方向的難度。':'平靜水面可降低浪況干擾，仍需確認浮標與轉向路線。'));
swim.features.push(c.current===1?'水流設為中性／未知，模型不增加淨水流修正；不代表現場沒有水流。':c.current===0?'假設整段淨順流，模型減少時間；折返路線的順逆流可能互相抵銷。':'假設整段淨逆流，模型增加時間，請確認水流方向與路線配置。');
swim.attention.push('核對出發方式、浮標轉向、出水點與大會水域公告，不只靠岸邊觀察判斷整段水況。');
swim.attention.push(c.wetsuit?'假設會穿防寒衣；是否允許，以當屆規則與當日水溫公告為準。':'目前不計穿防寒衣的效益，若當日改穿，請同步更新假設。');
swim.strategy.push(c.waves?'優先維持穩定換氣與辨向，在類似浪況練習可控節奏。':'建立穩定動作節奏，利用地標與浮標減少游偏。');
const density=c.bikeClimb/l.bike,bike={sport:'bike',title:'自行車｜控制負荷，保留跑步能力',tags:[l.bike+' km','爬升 '+c.bikeClimb.toLocaleString()+' m',density.toFixed(1)+' m/km'],features:[],attention:[],strategy:[]};
bike.features.push('每公里平均爬升 '+density.toFixed(1)+' m。'+(density>=12?'爬升密度較高，配速需容許地形造成的速度變動。':density>=5?'具一定起伏負荷，應辨識上坡與恢復路段。':'平均爬升密度較低，但不能排除局部陡坡。'));
bike.features.push('平均風速 '+c.wind+' km/h，'+get('exposure')+'。'+(c.wind>=20&&c.exposure>=1?'風曝露是重要變因，均速未必反映實際用力。':'仍需確認去回程風向與開闊路段。'));
bike.attention.push(c.technical?'有技術彎道／下坡假設，應確認轉彎、下坡與補給站位置，避免在不熟悉路段追時間。':'設定路線較流暢，實際迴轉、管制與人流仍可能造成減速。');
bike.attention.push(c.surface?'含粗糙路面假設，需確認車況、裝備固定與操控。':'確認施工與路面資訊；平整鋪面設定不保證全程一致。');
bike.strategy.push('按訓練驗證的功率、心率或主觀用力穩定輸出，上坡與逆風不為追均速持續加碼。');
bike.strategy.push('演練該距離的補給與騎跑銜接，把後段跑步能力一起納入騎乘計畫。');
const run={sport:'run',title:'跑步｜讓地形與熱負荷決定節奏',tags:[l.run+' km',c.temperature+'°C / '+c.humidity+'% RH',get('shade')],features:[],attention:[],strategy:[]};
run.features.push('跑步爬升 '+c.runClimb.toLocaleString()+' m，密度 '+(c.runClimb/l.run).toFixed(1)+' m/km。'+(c.runClimb/l.run>=8?'起伏會打斷固定配速，應按地形調整節奏。':'平均起伏較緩，橋梁、折返與出 T2 路段仍應事前辨識。'));
run.features.push('氣溫 '+c.temperature+'°C、濕度 '+c.humidity+'%，'+get('shade')+'。'+(c.temperature>=28?'較熱條件可能提高後段維持原配速的難度。':'請依預計進入跑步時段的條件核對，不只看開賽時氣溫。'));
run.attention.push(c.runSurface?'有混合／非鋪面假設，需留意抓地、不平路面與節奏改變。':'確認補給站、折返、圈數與擁擠點，避免錯過折返或漏圈。');
run.attention.push('跑步也受先前騎乘負荷與補給影響；模型尚未個別估計騎跑交互疲勞。');
run.strategy.push('出 T2 先建立可控節奏，結合地形與當日體感調整，保留後段修正空間。');
run.strategy.push('先在訓練驗證補給、飲水與降溫安排，再按大會站點規劃，避免比賽日首次嘗試。');
return [swim,bike,run];
}
const api={distances,fields,sports,splits,powers,defaultConditions,parseTime,formatTime,sumTimes,predict,courseAdvice};root.RaceModel=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
