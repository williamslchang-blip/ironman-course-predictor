(function(){
'use strict';
const $=id=>document.getElementById(id),D=CourseData,M=RaceModel;
let catalogPromise=null,records={},active=null,requestId=0;
const labels={swim:'游泳距離（km）',bike:'自行車距離（km）',run:'跑步距離（km）',bikeClimb:'自行車爬升（m）',runClimb:'跑步爬升（m）',temperature:'典型高溫（°C）',wind:'典型風速（km/h）'};
function el(tag,attrs={},text){const node=document.createElement(tag);for(const [k,v]of Object.entries(attrs))node.setAttribute(k,String(v));if(text!==undefined)node.textContent=text;return node;}
function open(dialog){if(dialog.open)return;if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');}
function close(dialog){if(dialog.close)dialog.close();else dialog.removeAttribute('open');}
function setHelp(tab){for(const button of document.querySelectorAll('[data-help-tab]')){const selected=button.dataset.helpTab===tab;button.setAttribute('aria-selected',selected);button.tabIndex=selected?0:-1;}for(const name of ['settings','analysis','method'])$('help-'+name).hidden=name!==tab;const warnings=$('warnings').textContent;const stale=$('results').classList.contains('stale');$('analysis-alert').textContent=(stale?'設定已變更，請先更新預估。\n':'')+warnings;$('analysis-alert').hidden=!(warnings||stale);}
function showHelp(tab='analysis',side){setHelp(tab);open($('help-dialog'));if(side)$('settings-'+side).scrollIntoView({block:'start'});}
$('open-help').addEventListener('click',()=>showHelp());$('close-help').addEventListener('click',()=>close($('help-dialog')));
const helpTabs=[...document.querySelectorAll('[data-help-tab]')];for(const b of helpTabs){b.addEventListener('click',()=>setHelp(b.dataset.helpTab));b.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?2:(helpTabs.indexOf(b)+(e.key==='ArrowRight'?1:2))%3;setHelp(helpTabs[n].dataset.helpTab);helpTabs[n].focus();});}
document.querySelectorAll('[data-advanced]').forEach(b=>b.addEventListener('click',()=>showHelp('settings',b.dataset.advanced)));
$('apply-settings').addEventListener('click',()=>{if(render())close($('help-dialog'));else close($('help-dialog'));});
$('close-lookup').addEventListener('click',()=>{requestId++;close($('lookup-dialog'));});
function signature(side){return $(side+'-name').value.trim()+'|'+$(side+'-distance').value;}
function updateStatus(side){const record=records[side];$(side+'-lookup-status').textContent=record?(record.signature===signature(side)?record.label:'場次或組別已變更，請重新讀取賽道或確認手動資料。'):'尚無連網資料，可搜尋場次、讀取網址或補充資料。';}
function getRecords(){return JSON.parse(JSON.stringify(records));}
function restoreRecords(value){records={};for(const side of ['reference','target'])if(value?.[side]&&typeof value[side].signature==='string')records[side]=value[side];for(const side of ['reference','target']){$(side+'-course-url').value=records[side]?.source||$(side+'-source').value;updateStatus(side);}}
window.CourseLookup={getRecords,restoreRecords,isStale:()=>['reference','target'].some(s=>records[s]&&records[s].signature!==signature(s))};
for(const side of ['reference','target']){for(const type of ['input','change']){ $(side+'-name').addEventListener(type,()=>updateStatus(side));$(side+'-distance').addEventListener(type,()=>updateStatus(side));}$(side+'-course-url').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();readUrl(side);}});}
document.querySelectorAll('[data-manual]').forEach(b=>b.addEventListener('click',()=>{const side=b.dataset.manual;delete records[side];$(side+'-evidence').value='estimate';$(side+'-lookup-status').textContent='已確認採用手動資料，請核對條件後更新預估。';invalidate();}));
$('race-form').addEventListener('submit',event=>{for(const side of ['reference','target'])if(records[side]&&records[side].signature!==signature(side)){event.preventDefault();event.stopImmediatePropagation();$('errors').hidden=false;$('errors').textContent='場次或組別已變更。請重新讀取該場賽道，或在說明選項確認採用手動資料。';$('result-body').hidden=true;return;}},true);
$('race-form').addEventListener('input',()=>{$('analysis-status').textContent='設定已變更，請更新預估。';});$('race-form').addEventListener('submit',()=>{$('analysis-status').textContent=$('errors').hidden?'✓ 已更新；完整資料與解說請開啟「說明與賽道分析」。':'';});
async function fetchResource(url,kind='json'){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),kind==='json'?16000:45000);try{const response=await fetch(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error(response.status===429?'查詢服務暫時限流，請稍後重試。':'來源暫時無法讀取（HTTP '+response.status+'）。');const text=await response.text();if(text.length>2000000)throw Error('來源內容過大，請改用直接的賽道頁或 GPX。');return kind==='json'?JSON.parse(text):text;}catch(e){if(e.name==='AbortError')throw Error('讀取逾時，請稍後重試或改用更直接的賽道網址。');throw e;}finally{clearTimeout(timer);}}
async function raceList(){if(!catalogPromise)catalogPromise=fetchResource(D.base+'/races').then(j=>{if(!Array.isArray(j.races))throw Error('賽事目錄格式不符。');return j.races;}).catch(e=>{catalogPromise=null;throw e;});return catalogPromise;}
function begin(side,message){active=side;const id=++requestId;$('lookup-title').textContent=(side==='reference'?'過往':'本次')+'賽道資料';$('lookup-message').textContent=message;$('lookup-content').replaceChildren();open($('lookup-dialog'));return id;}
function fail(error,id){if(id!==requestId)return;$('lookup-message').textContent=error.message||'讀取失敗，請稍後重試。';$('lookup-content').replaceChildren(el('p',{class:'help'},'可改貼官方賽道頁、選用可讀取的 PDF，或在「補充／核對資料」手動輸入。'));}
async function search(side){const query=$(side+'-name').value.trim();if(!query){$(side+'-lookup-status').textContent='請先輸入場次名稱，可用中文或英文。';$(side+'-name').focus();return;}const id=begin(side,'正在連網搜尋賽事目錄…');try{const list=await raceList();if(id!==requestId)return;const matches=D.findRaces(list,query);$('lookup-message').textContent=matches.length?'選擇相符場次，再核對來源年份與路線。':'目錄沒有相符場次；可改用英文名稱或直接貼上賽道網址。';const listNode=el('div',{class:'race-options'});for(const r of matches){const button=el('button',{type:'button',class:'race-option'});button.append(el('strong',{},r.name),el('span',{},(r.date||'年份未明')+' · '+(r.type==='full'?'226':'113')+' km'));button.addEventListener('click',()=>loadRace(side,r.slug));listNode.append(button);}$('lookup-content').append(listNode,el('p',{class:'help'},'來源：metrica.fit。目錄以 IRONMAN／70.3 為主，未涵蓋所有 51.5 與歷年賽事。'));}catch(e){fail(e,id);}}
async function loadRace(side,slug){if(!/^[a-z0-9-]+$/.test(slug))return;const id=begin(side,'正在取得賽道與典型氣候…');try{const payload=await fetchResource(D.base+'/races/'+slug);if(id!==requestId)return;preview(side,D.adaptRace(payload));}catch(e){fail(e,id);}}
async function readUrl(side){let url;try{url=D.publicUrl($(side+'-course-url').value);}catch(e){$(side+'-lookup-status').textContent=e.message;return;}const u=new URL(url),match=u.hostname==='www.metrica.fit'||u.hostname==='metrica.fit'?u.pathname.match(/^\/races\/([a-z0-9-]+)\/?$/):null;if(match){loadRace(side,match[1]);return;}const id=begin(side,'正在讀取公開網址文字，PDF 可能需要較久…');try{const text=await fetchResource('https://r.jina.ai/'+url,'text');if(id!==requestId)return;if(/(?:error|security|authorization|access denied|captcha)/i.test(text.slice(0,180))&&!/(swim|bike|run|游泳|爬升)/i.test(text))throw Error('來源限制讀取，未取得可用賽道文字。');preview(side,D.extractText(text,url,$(side+'-distance').value));}catch(e){fail(e,id);}}
function preview(side,data){
$('lookup-message').textContent='請核對後再採用；僅擷取資料，不會把網頁文字當成指令。';const container=$('lookup-content');container.replaceChildren(el('h3',{},data.name));const source=el('a',{href:D.publicUrl(data.source),target:'_blank',rel:'noopener noreferrer',class:'source-link'},'查看原始來源 ↗');container.append(source,el('p',{class:'help'},'資料年份／日期：'+(data.date||'無法確認')+' · 來源：'+data.provider));
const selected={},grid=el('div',{class:'preview-grid'});let readable=Object.keys(data.values).length;
for(const [k,v]of Object.entries(data.values)){const line=el('div',{class:'preview-value'});line.append(el('span',{},labels[k]||k),el('strong',{},String(v)));grid.append(line);}
for(const [k,options]of Object.entries(data.candidates)){if(!options.length)continue;readable++;const label=el('label',{},labels[k]),select=el('select',{'data-import-field':k});select.append(el('option',{value:''},k.endsWith('Climb')?'不匯入／待補充':data.kind==='catalog'?'保留組別標準距離':'保留目前距離'));
for(const item of options){const option=el('option',{value:item.value},String(item.value));option.title=item.evidence;select.append(option);}if(data.kind==='url'&&options.length===1)select.value=options[0].value;selected[k]=select;label.append(select);grid.append(label);const snippets=el('details');snippets.append(el('summary',{},'查看 '+labels[k]+' 擷取依據'));for(const item of options)snippets.append(el('p',{class:'excerpt'},item.evidence));grid.append(snippets);}
container.append(grid);for(const note of data.notes)container.append(el('p',{class:'help'},note));
if(!readable){container.append(el('div',{class:'notice'},'本頁沒有可可靠辨識的距離或爬升數值。請改用更直接的賽道頁、文字版 PDF 或 GPX；這次不會自動填入假設資料。'));return;}
const requestedYear=D.yearOf($(side+'-name').value),guideYear=D.yearOf(data.date),needsYear=!guideYear||(requestedYear&&requestedYear!==guideYear);let yearBox=null;if(needsYear){const label=el('label',{class:'confirm-row'});yearBox=el('input',{type:'checkbox',id:'lookup-year-confirm'});label.append(yearBox,document.createTextNode(guideYear?'來源年份 '+guideYear+' 與輸入 '+requestedYear+' 不同，我已核對路線並同意作為參考。':'來源年份無法確認，我已自行核對場次與路線。'));container.append(label);}
const adopt=el('button',{type:'button',class:'primary',id:'adopt-course'},'採用核對後的資料 ↗');adopt.disabled=!!needsYear;if(yearBox)yearBox.addEventListener('change',()=>adopt.disabled=!yearBox.checked);
adopt.addEventListener('click',()=>{if(yearBox&&!yearBox.checked)return;const values={...data.values},lengths={...D.nominal[data.group]};for(const [k,select]of Object.entries(selected))if(select.value!==''){const value=Number(select.value);if(['swim','bike','run'].includes(k))lengths[k]=value;else values[k]=value;}
if(!Object.keys(values).length&&!Object.values(selected).some(s=>s.value!=='')){$('lookup-message').textContent='請至少選擇一項已核對的距離或爬升數值；也可改用手動補充。';return;}if(data.kind==='url')for(const s of ['swim','bike','run'])if(!selected[s]||selected[s].value==='')lengths[s]=Number($((side==='target'?'length-':'ref-length-')+s).value);
$(side+'-distance').value=data.group;for(const s of ['swim','bike','run'])$((side==='target'?'length-':'ref-length-')+s).value=lengths[s];for(const f of M.fields)$(side+'-'+f.key).value=values[f.key]??f.value;
if(!$(side+'-name').value.trim())$(side+'-name').value=data.name;$(side+'-source').value=data.source;$(side+'-course-url').value=data.source;$(side+'-evidence').value='estimate';const imported=Object.keys(values).map(k=>labels[k]||k).join('、');$(side+'-notes').value='連網來源：'+data.provider+'；資料日期：'+(data.date||'未明')+'；讀取時間：'+new Date().toISOString()+'。\n已讀取：'+(imported||'所選距離')+'。\n'+data.notes.join('\n');
records[side]={signature:signature(side),source:data.source,date:data.date||'',label:'已讀取 '+data.provider+' · '+(data.date||'年份待核對')+' · 仍有未提供條件',provider:data.provider};invalidate();updateStatus(side);$('analysis-status').textContent='賽道資料已套用，請更新成績預估。';close($('lookup-dialog'));});
container.append(adopt);
}
document.querySelectorAll('[data-search-race]').forEach(b=>b.addEventListener('click',()=>search(b.dataset.searchRace)));document.querySelectorAll('[data-read-url]').forEach(b=>b.addEventListener('click',()=>readUrl(b.dataset.readUrl)));
$('demo').addEventListener('click',()=>{records={};for(const s of ['reference','target']){$(s+'-course-url').value='';$(s+'-lookup-status').textContent='虛構示範；尚未讀取真實賽道資料。';}});
for(const s of ['reference','target'])$(s+'-lookup-status').textContent='虛構示範；可搜尋場次或貼上網址以使用真實資料。';
})();

/* Require real course adoption or an explicit manual confirmation for custom forecasts. */
(function(){
const signatures={},sides=['reference','target'],sig=s=>document.getElementById(s+'-name').value.trim()+'|'+document.getElementById(s+'-distance').value;
const ready=()=>{const r=CourseLookup.getRecords();return sides.every(s=>r[s]?.signature===sig(s)||signatures[s]===sig(s));};
const originalRead=window.readData;window.readData=function(){if(!isDemo&&!ready())throw Error('請先為兩場比賽讀取賽道，或在「補充／核對資料」確認使用手動資料。');return originalRead();};
document.querySelectorAll('[data-manual]').forEach(b=>b.addEventListener('click',()=>{const s=b.dataset.manual;signatures[s]=sig(s);}));
const restore=CourseLookup.restoreRecords;CourseLookup.restoreRecords=function(records){restore(records);for(const s of sides){delete signatures[s];if(!records[s])signatures[s]=sig(s);}};
document.getElementById('demo').addEventListener('click',()=>{for(const s of sides)delete signatures[s];});
})();

// Open optional model/analysis panels when following report links.
(function(){
  function revealHash(){
    const tab=location.hash==='#method'?'method':(['#course-guide','#analysis'].includes(location.hash)?'analysis':null);
    if(!tab)return;
    document.getElementById('open-help').click();
    Array.from(document.querySelectorAll('[data-help-tab]')).find(b=>b.dataset.helpTab===tab)?.click();
  }
  window.addEventListener('hashchange',revealHash);
  revealHash();
})();