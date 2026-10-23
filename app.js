'use strict';
const $=id=>document.getElementById(id);
const {distances,parseTime,formatTime,predict}=RaceModel;
const sportNames={swim:'游泳',bike:'自行車',run:'跑步',t1:'T1 游→騎',t2:'T2 騎→跑'};
const colors={swim:'#5298a8',bike:'#dfac73',run:'#79ac8d',t1:'#b9c3bb',t2:'#b9c3bb'};
const conditionFields=[{key:'bikeClimb',label:'自行車爬升（m）',min:0,max:10000,step:1,value:1000},{key:'runClimb',label:'跑步爬升（m）',min:0,max:5000,step:1,value:150},{key:'wind',label:'平均風速（km/h）',min:0,max:50,step:.1,value:10},{key:'temperature',label:'比賽氣溫（°C）',min:0,max:45,step:.1,value:24},{key:'waves',label:'游泳浪況',options:['平靜水面','輕浪','明顯浪'],value:0}];
const lengthFields=[{key:'swim',label:'游泳 km',min:.2,max:10,step:.0001},{key:'bike',label:'自行車 km',min:5,max:400,step:.001},{key:'run',label:'跑步 km',min:1,max:100,step:.0001}];
const defaults={swim:'01:20:00',bike:'06:10:00',run:'04:30:00',t1:'00:08:00',t2:'00:05:00'};
const storageKey='pace-atlas-v1';let lastData=null,lastResult=null,isDemo=true,dirty=false;
function element(tag,attrs={},text){const el=document.createElement(tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));if(text!==undefined)el.textContent=text;return el;}
function addField(parent,definition,prefix,value){
  const id=prefix+'-'+definition.key,label=element('label',{for:id},definition.label);let field;
  if(definition.options){field=element('select',{id});definition.options.forEach((name,i)=>field.append(element('option',{value:i},name)));field.value=value??definition.value;}
  else{field=element('input',{id,type:'number',min:definition.min,max:definition.max,step:definition.step,value:value??definition.value??0,inputmode:'decimal'});}
  label.append(field);$(parent).append(label);
}
for(const key of Object.keys(defaults)){const label=element('label',{for:'time-'+key},sportNames[key]);label.append(element('input',{id:'time-'+key,type:'text',value:defaults[key],placeholder:'00:00:00',inputmode:'text',maxlength:12,autocomplete:'off'}));$('time-fields').append(label);}
for(const prefix of ['reference','target'])for(const field of conditionFields)addField(prefix+'-fields',field,prefix,field.value);
for(const field of lengthFields)addField('target-lengths',field,'length',distances[226][field.key]);
function number(id){const value=$(id).value.trim();return value===''?NaN:Number(value);}
function readData(){return {athlete:$('athlete').value.trim(),referenceName:$('reference-name').value.trim(),targetName:$('target-name').value.trim(),referenceDistance:$('reference-distance').value,targetDistance:$('target-distance').value,times:Object.fromEntries(Object.keys(defaults).map(k=>[k,parseTime($('time-'+k).value)])),reference:Object.fromEntries(conditionFields.map(f=>[f.key,number('reference-'+f.key)])),target:Object.fromEntries(conditionFields.map(f=>[f.key,number('target-'+f.key)])),lengths:Object.fromEntries(lengthFields.map(f=>[f.key,number('length-'+f.key)])),spread:number('spread')};}
function updatePb(){const values=Object.keys(defaults).map(k=>parseTime($('time-'+k).value));$('pb-total').querySelector('strong').textContent=values.every(Number.isFinite)?formatTime(values.reduce((a,b)=>a+b,0)):'格式待修正';}
function pace(sport,seconds,lengths){if(sport==='bike')return (lengths.bike/(seconds/3600)).toFixed(1)+' km/h';if(sport==='swim')return shortTime(seconds/(lengths.swim*10))+' /100m';if(sport==='run')return shortTime(seconds/lengths.run)+' /km';return '';}
function shortTime(value){const n=Math.round(value);return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');}
function signedMinutes(seconds){if(Math.abs(seconds)<30)return '約 0 分';return (seconds>0?'+':'−')+Math.abs(seconds/60).toFixed(1)+' 分';}
function describeClimb(value){return (value>=0?'+':'−')+Math.abs(Math.round(value)).toLocaleString()+' m';}
function syncBadge(){const badge=$('data-badge');badge.textContent=dirty?'尚未更新':isDemo?'示範資料':'自訂輸入';badge.classList.toggle('personal',!isDemo&&!dirty);}
function render(){
  const data=readData();let result;
  updatePb();$('spread-value').textContent=data.spread+'%';
  try{result=predict(data);}catch(error){$('errors').hidden=false;$('errors').textContent=error.message+' 請檢查必填數值與時間格式。';$('result-body').hidden=true;lastData=null;lastResult=null;return false;}
  $('errors').hidden=true;$('result-body').hidden=false;$('warnings').hidden=!result.warnings.length;$('warnings').textContent=result.warnings.join('\n');
  dirty=false;$('results').classList.remove('stale');syncBadge();
  $('result-title').textContent=data.targetName||'我的目標賽事';
  $('result-subtitle').textContent=(data.athlete?data.athlete+' · ':'')+data.targetDistance+' 距離組別 · '+(data.referenceName||'參考賽事')+' '+formatTime(Object.values(data.times).reduce((a,b)=>a+b,0))+' 作為基準';
  $('scenario-cards').replaceChildren();
  const labels={optimistic:['樂觀','OPTIMISTIC','順利發揮・環境較有利'],neutral:['中性','NEUTRAL','目前假設下的計畫基準'],conservative:['保守','CONSERVATIVE','為狀況變動保留餘裕']};
  for(const [key,[zh,en,note]] of Object.entries(labels)){
    const s=result.scenarios[key],card=element('article',{class:'scenario-card '+key});const label=element('div',{class:'scenario-label'});label.append(element('i',{'aria-hidden':'true'}),document.createTextNode(zh));card.append(label,element('span',{class:'en'},en),element('div',{class:'scenario-time'},formatTime(s.total)),element('div',{class:'scenario-foot'},note));
    const bar=element('div',{class:'stacked','aria-hidden':'true'});for(const sport of Object.keys(defaults)){const segment=element('span');segment.style.width=(s[sport]/s.total*100)+'%';segment.style.backgroundColor=colors[sport];bar.append(segment);}card.append(bar);$('scenario-cards').append(card);
  }
  $('splits').replaceChildren();
  for(const sport of ['swim','t1','bike','t2','run','total']){
    const row=element('tr'),name=element('td',{},sport==='total'?'預估總時間':sportNames[sport]);row.append(name);
    for(const key of Object.keys(labels)){const sec=result.scenarios[key][sport],cell=element('td',{},formatTime(sec));if(['swim','bike','run'].includes(sport))cell.append(element('span',{class:'pace-sub'},pace(sport,sec,data.lengths)));row.append(cell);}$('splits').append(row);
  }
  $('impact-bars').replaceChildren();const maxImpact=Math.max(60,...Object.values(result.impacts).map(Math.abs));
  for(const sport of ['swim','bike','run']){const value=result.impacts[sport],row=element('div',{class:'impact-row'}),track=element('div',{class:'impact-track','aria-hidden':'true'}),bar=element('span');bar.style.width=(Math.abs(value)/maxImpact*50)+'%';bar.style.left=value>=0?'50%':(50-Math.abs(value)/maxImpact*50)+'%';bar.style.backgroundColor=value>=0?'#dca17a':'#79ac8d';track.append(bar);row.append(element('span',{},sportNames[sport]),track,element('strong',{},signedMinutes(value)));$('impact-bars').append(row);}
  $('impact-description').replaceChildren();for(const [label,value] of [['自行車等比例爬升差',describeClimb(result.bikeClimbDiff)],['跑步等比例爬升差',describeClimb(result.runClimbDiff)],['目標氣溫 / 平均風',data.target.temperature+'°C / '+data.target.wind+' km/h']]){const block=element('div');block.append(element('span',{},label),element('strong',{},value));$('impact-description').append(block);}
  let printSummary=document.querySelector('.print-summary');if(!printSummary){printSummary=element('div',{class:'print-summary'});$('result-header')?.after(printSummary);if(!printSummary.parentNode)$('result-body').prepend(printSummary);}
  printSummary.textContent='參考 '+data.referenceDistance+'：游 '+formatTime(data.times.swim)+'／騎 '+formatTime(data.times.bike)+'／跑 '+formatTime(data.times.run)+'；目標 '+[data.lengths.swim,data.lengths.bike,data.lengths.run].join(' / ')+' km；目標爬升 '+data.target.bikeClimb+' / '+data.target.runClimb+' m；原氣溫 '+data.reference.temperature+'°C，風 '+data.reference.wind+' km/h；情境幅度 '+data.spread+'%。';
  lastData=data;lastResult=result;return true;
}
function invalidate(){dirty=true;isDemo=false;$('results').classList.add('stale');syncBadge();updatePb();$('spread-value').textContent=$('spread').value+'%';$('storage-status').textContent='';}
$('race-form').addEventListener('input',invalidate);
$('race-form').addEventListener('change',event=>{if(event.target.id==='target-distance'){const group=$('target-distance').value;for(const sport of ['swim','bike','run'])$('length-'+sport).value=distances[group][sport];}invalidate();});
$('race-form').addEventListener('submit',event=>{event.preventDefault();if(render()&&window.innerWidth<721)$('results').scrollIntoView({behavior:'smooth',block:'start'});else if(!$('errors').hidden)$('errors').scrollIntoView({block:'center'});});
$('demo').addEventListener('click',()=>{if(!isDemo&&!confirm('載入示範會取代目前表單，已儲存在瀏覽器的設定不受影響。是否繼續？'))return;setData({athlete:'示範選手',referenceName:'示範：平緩賽道 PB',targetName:'示範：溫暖起伏賽道',referenceDistance:'226',targetDistance:'226',times:Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,parseTime(v)])),reference:{bikeClimb:1000,runClimb:150,wind:10,temperature:24,waves:0},target:{bikeClimb:1600,runClimb:220,wind:18,temperature:28,waves:1},lengths:{...distances[226]},spread:5});isDemo=true;render();$('storage-status').textContent='目前為虛構示範資料，並非真實選手預測。';});
function setData(d){
  if(!d||typeof d!=='object')throw new Error('設定內容無效。');predict(d);
  $('athlete').value=String(d.athlete||'').slice(0,40);$('reference-name').value=String(d.referenceName||'').slice(0,80);$('target-name').value=String(d.targetName||'').slice(0,80);$('reference-distance').value=d.referenceDistance;$('target-distance').value=d.targetDistance;
  for(const k of Object.keys(defaults))$('time-'+k).value=formatTime(d.times[k]);for(const p of ['reference','target'])for(const f of conditionFields)$(p+'-'+f.key).value=d[p][f.key];for(const s of ['swim','bike','run'])$('length-'+s).value=d.lengths[s];$('spread').value=d.spread;
  $('gpx-file').value='';$('gpx-status').textContent='';$('elevation-profile').replaceChildren();
}
$('save').addEventListener('click',()=>{if(!render())return;try{localStorage.setItem(storageKey,JSON.stringify({version:1,data:lastData,isDemo}));$('storage-status').textContent='已儲存在此瀏覽器；未上傳任何個人輸入。';}catch{$('storage-status').textContent='瀏覽器不允許儲存，仍可計算與下載 CSV。';}});
$('restore').addEventListener('click',()=>{try{const raw=localStorage.getItem(storageKey);if(!raw){$('storage-status').textContent='此瀏覽器尚無儲存設定。';return;}const saved=JSON.parse(raw);if(saved.version!==1)throw new Error();setData(saved.data);isDemo=!!saved.isDemo;render();$('storage-status').textContent='已讀取上次儲存設定。';}catch{$('storage-status').textContent='無法讀取設定：資料損壞或瀏覽器限制，請重新輸入。';}});
$('clear').addEventListener('click',()=>{try{localStorage.removeItem(storageKey);$('storage-status').textContent='已清除此瀏覽器的儲存設定。';}catch{$('storage-status').textContent='瀏覽器不允許操作儲存空間。';}});
$('print').addEventListener('click',()=>{if(render())window.print();else $('errors').scrollIntoView({block:'center'});});
function csvCell(value){let s=String(value??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
$('export').addEventListener('click',()=>{
  if(!lastData||!lastResult||dirty)return;
  const d=lastData,r=lastResult,rows=[['PACE ATLAS 情境分析','模型 1.0，未經實證校準'],['資料類型',isDemo?'虛構示範':'使用者輸入'],['選手',d.athlete],['參考賽事',d.referenceName],['目標賽事',d.targetName],['參考／目標距離組別',d.referenceDistance,d.targetDistance],['情境幅度 %',d.spread],['分段','樂觀','中性','保守']];
  for(const sport of ['swim','t1','bike','t2','run','total'])rows.push([sport==='total'?'總時間':sportNames[sport],...['optimistic','neutral','conservative'].map(s=>formatTime(r.scenarios[s][sport]))]);
  rows.push([],['輸入參數','原賽事','目標']);for(const f of conditionFields)rows.push([f.label,f.options?f.options[d.reference[f.key]]:d.reference[f.key],f.options?f.options[d.target[f.key]]:d.target[f.key]]);for(const f of lengthFields)rows.push([f.label,distances[d.referenceDistance][f.key],d.lengths[f.key]]);for(const k of Object.keys(defaults))rows.push(['參考 '+sportNames[k],formatTime(d.times[k])]);rows.push([],['重要限制','三種情境不是機率預測或完賽保證。請參閱網站模型假設。']);for(const warning of r.warnings)rows.push(['提示',warning]);
  const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=element('a',{href:url,download:'PACE-ATLAS-分析.csv'});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
function haversine(a,b){const rad=Math.PI/180,dLat=(b.lat-a.lat)*rad,dLon=(b.lon-a.lon)*rad;const h=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;return 6371*2*Math.asin(Math.min(1,Math.sqrt(h)));}
$('gpx-file').addEventListener('change',async()=>{
  const file=$('gpx-file').files[0];if(!file)return;$('elevation-profile').replaceChildren();
  if(file.size>10*1024*1024){$('gpx-status').textContent='檔案超過 10 MB，請先精簡路線點位。';return;}
  try{
    const xml=new DOMParser().parseFromString(await file.text(),'application/xml');if(xml.querySelector('parsererror'))throw new Error('GPX XML 格式錯誤。');
    const segments=Array.from(xml.getElementsByTagNameNS('*','trkseg'));const groups=segments.length?segments.map(s=>Array.from(s.getElementsByTagNameNS('*','trkpt'))):[Array.from(xml.getElementsByTagNameNS('*','rtept'))];
    let distance=0,climb=0,elevCount=0,pointCount=0;const profile=[];
    for(const nodes of groups){let prev=null,prevSmoothed=null;const points=nodes.map(node=>{const lat=Number(node.getAttribute('lat')),lon=Number(node.getAttribute('lon')),eleNode=node.getElementsByTagNameNS('*','ele')[0];const ele=eleNode&&eleNode.textContent.trim()!==''?Number(eleNode.textContent):NaN;return {lat,lon,ele,valid:node.hasAttribute('lat')&&node.hasAttribute('lon')&&Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180};});
      for(let i=0;i<points.length;i++){const p=points[i];if(!p.valid){prev=null;prevSmoothed=null;continue;}pointCount++;if(prev)distance+=haversine(prev,p);prev=p;if(Number.isFinite(p.ele)){elevCount++;const windowPoints=points.slice(Math.max(0,i-2),i+3).filter(q=>q.valid&&Number.isFinite(q.ele));const smooth=windowPoints.reduce((s,q)=>s+q.ele,0)/windowPoints.length;if(prevSmoothed!==null)climb+=Math.max(0,smooth-prevSmoothed);prevSmoothed=smooth;profile.push({distance,elevation:smooth});}else prevSmoothed=null;}
    }
    if(pointCount<2||distance<=0)throw new Error('沒有足夠的有效路線點。');if(distance<5||distance>400)throw new Error('路線需介於 5～400 km；請確認是完整自行車路線。');
    const coverage=elevCount/pointCount;if(coverage>=.95&&climb>10000)throw new Error('爬升超過模型範圍，請檢查高度資料。');
    $('length-bike').value=distance.toFixed(3);if(coverage>=.95)$('target-bikeClimb').value=Math.round(climb);invalidate();
    $('gpx-status').textContent='已填入 '+distance.toFixed(2)+' km'+(coverage>=.95?'、平滑後爬升 '+Math.round(climb).toLocaleString()+' m。':'。高度資料不完整，爬升未更動，請手動填寫。')+' 請確認是否需要乘上圈數，再更新預估。';
    if(profile.length>1){const points=profile.filter((_,i)=>i%Math.max(1,Math.ceil(profile.length/250))===0);if(points.at(-1)!==profile.at(-1))points.push(profile.at(-1));const min=Math.min(...points.map(p=>p.elevation)),max=Math.max(...points.map(p=>p.elevation)),range=Math.max(1,max-min);const coords=points.map(p=>(p.distance/distance*280+10).toFixed(1)+','+(70-(p.elevation-min)/range*55).toFixed(1));const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 300 85');svg.setAttribute('role','img');svg.setAttribute('aria-label','匯入路線的高度示意，垂直比例經縮放');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d','M'+coords.join(' L'));path.setAttribute('fill','none');path.setAttribute('stroke','#49826c');path.setAttribute('stroke-width','2');svg.append(path);$('elevation-profile').append(svg);}
  }catch(error){$('gpx-status').textContent='無法匯入：'+error.message;}
});
$('demo').click();
