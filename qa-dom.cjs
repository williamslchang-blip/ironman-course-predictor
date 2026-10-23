'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const qaRoot=process.env.PACE_ATLAS_QA_ROOT||path.join(process.env.TEMP||'.','pace-atlas-qa','node_modules','jsdom');
const {JSDOM,VirtualConsole}=require(qaRoot),messages=[];
const vc=new VirtualConsole();vc.on('jsdomError',e=>messages.push(e.message));
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://williamslchang-blip.github.io/ironman-course-predictor/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,$=id=>w.document.getElementById(id);
w.confirm=()=>true;w.print=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
w.eval(fs.readFileSync('model.js','utf8'));w.eval(fs.readFileSync('app.js','utf8'));
const style=w.document.createElement('style');style.textContent=fs.readFileSync('styles.css','utf8');w.document.head.append(style);
const change=(id,v)=>{$(id).value=v;$(id).dispatchEvent(new w.Event('input',{bubbles:true}));$(id).dispatchEvent(new w.Event('change',{bubbles:true}));};
const submit=()=>$('race-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
function healthy(){assert.equal($('errors').hidden,true,$('errors').textContent);assert.equal(w.document.querySelectorAll('.scenario-card').length,3);assert.equal($('splits').children.length,6);assert.equal(w.document.querySelectorAll('.advice-card').length,3);}
healthy();assert.ok($('reference-name').value.includes('示範'));
$('tab-target').click();assert.equal($('pane-target').hidden,false);assert.equal($('pane-reference').hidden,true);assert.equal($('tab-target').getAttribute('aria-selected'),'true');
$('tab-target').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal($('pane-scenarios').hidden,false);
change('target-name','');submit();assert.equal($('errors').hidden,false);assert.equal($('result-body').hidden,true);
change('target-name','2027 <img src=x onerror=alert(1)>');submit();healthy();assert.ok($('result-title').textContent.includes('<img'));assert.equal($('result-title').querySelector('img'),null);
change('official-total','01:00:00');submit();assert.ok($('errors').textContent.includes('2 秒'));$('fill-total').click();submit();healthy();
for(const from of ['51.5','113','226'])for(const to of ['51.5','113','226']){change('reference-distance',from);change('target-distance',to);submit();healthy();assert.equal(Number($('ref-length-bike').value),w.RaceModel.distances[from].bike);assert.equal(Number($('length-bike').value),w.RaceModel.distances[to].bike);}
change('target-temperature','33');change('target-humidity','80');submit();assert.ok($('advice-cards').textContent.includes('33°C'));
change('target-source','javascript:alert(1)');submit();assert.ok($('errors').textContent.includes('http'));change('target-source','https://example.org/course');submit();healthy();
$('save').click();assert.ok(w.localStorage.getItem('pace-atlas-v1'));const name=$('target-name').value;change('target-name','changed');$('restore').click();assert.equal($('target-name').value,name);healthy();$('clear').click();assert.equal(w.localStorage.getItem('pace-atlas-v1'),null);
const v1={version:1,isDemo:false,data:{athlete:'old',referenceName:'Old race',targetName:'New race',referenceDistance:'226',targetDistance:'226',times:{swim:4800,bike:22200,run:16200,t1:480,t2:300},reference:{bikeClimb:1000,runClimb:150,wind:10,temperature:24,waves:0},target:{bikeClimb:1200,runClimb:200,wind:15,temperature:25,waves:1},lengths:{swim:3.8,bike:180,run:42.195},spread:5}};
w.localStorage.setItem('pace-atlas-v1',JSON.stringify(v1));$('restore').click();healthy();assert.ok($('storage-status').textContent.includes('遷移'));
const ids=Array.from(w.document.querySelectorAll('[id]'),e=>e.id);assert.equal(ids.length,new Set(ids).size);
async function gpxTest(){
const xml='<gpx><trk><trkseg><trkpt lat="0" lon="0"><ele>0</ele></trkpt><trkpt lat="0" lon=".05"><ele>10</ele></trkpt><trkpt lat="0" lon=".10"><ele>20</ele></trkpt></trkseg></trk></gpx>';
Object.defineProperty($('gpx-file'),'files',{configurable:true,value:[{size:xml.length,text:async()=>xml}]});$('gpx-file').dispatchEvent(new w.Event('change',{bubbles:true}));await new Promise(r=>w.setTimeout(r,20));assert.ok(Number($('length-bike').value)>11&&Number($('length-bike').value)<12);assert.ok($('gpx-status').textContent.includes('已填入'));submit();healthy();
const prior=$('length-bike').value;Object.defineProperty($('gpx-file'),'files',{configurable:true,value:[{size:30,text:async()=>'<not-valid'}]});$('gpx-file').dispatchEvent(new w.Event('change',{bubbles:true}));await new Promise(r=>w.setTimeout(r,20));assert.equal($('length-bike').value,prior);assert.ok($('gpx-status').textContent.includes('無法匯入'));
assert.deepEqual(messages,[],'DOM/CSS errors: '+messages.join('; '));dom.window.close();console.log('PASS: live DOM startup, tabs/keyboard, all distance selectors, total mismatch/recovery, names, conditional advice, safe URLs/text, storage, v1 migration, GPX success/failure, unique IDs and CSS parsing.');
}
gpxTest().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
