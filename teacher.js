import {firebaseConfig, TEACHER_UID, isConfigured} from './firebase-config.js';
const $=id=>document.getElementById(id), say=s=>$('msg').textContent=s;
const roles={tone:'音色偵探',tempo:'速度偵探',feeling:'情緒偵探',director:'廣告導演',advisor:'配樂總監'};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let records={},groupKeys={},selected='',meta={},unsubscribeStudents=null,unsubscribeGroups=null,unsubscribeConfig=null,fiveGroups={};
if(!isConfigured){say('尚未填寫 Firebase 設定');$('login').disabled=true;}
else try {
 const [{initializeApp},{getAuth,GoogleAuthProvider,signInWithPopup,signInWithRedirect,onAuthStateChanged},{getDatabase,ref,onValue,runTransaction,serverTimestamp,set}]=await Promise.all([
 import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js')]);
 const app=initializeApp(firebaseConfig,'yanhe-adventure-teacher'),auth=getAuth(app),db=getDatabase(app);
 const isTeacher=u=>u&&u.uid===TEACHER_UID;
 $('login').onclick=async()=>{try{await signInWithPopup(auth,new GoogleAuthProvider())}catch(e){if(e.code==='auth/popup-blocked')await signInWithRedirect(auth,new GoogleAuthProvider());else say('登入失敗：'+e.code)}};
 $('filter').onchange=render;
 $('lessonSelect').onchange=()=>selectLesson($('lessonSelect').value);
 $('fiveGroups').innerHTML=Array.from({length:8},(_,i)=>`<label style="padding:9px;background:#f4f8fd;border:1px solid #dce5ef;border-radius:9px"><input type="checkbox" data-five="${i+1}"> 第${i+1}組（5把）</label>`).join('');
 $('saveFive').onclick=async()=>{if(!selected){say('請先選擇課堂');return}const o={};$('fiveGroups').querySelectorAll('[data-five]').forEach(c=>{if(c.checked)o[c.dataset.five]=true});try{await set(ref(db,`adventureSessions/${selected}/meta/fivePersonGroups`),Object.keys(o).length?o:null);$('fiveState').textContent='✅ 已儲存';say('✅ 五人組設定已同步，請學生重新進入第三關確認。')}catch(e){$('fiveState').textContent='🔴 儲存失敗：'+(e.code||e.message);say('無法儲存五人組設定：'+(e.code||e.message))}};
 $('createLesson').onclick=async()=>{
   let code=$('newLesson').value.trim().toUpperCase(),cls=$('className').value.trim();
   if(!/^[A-Z0-9-]{3,24}$/.test(code)||!cls){say('請填班級名稱，並使用3～24碼英數字或 - 作課堂代碼');return;}
   try{const r=await runTransaction(ref(db,`adventureSessions/${code}/meta`),old=>old===null?{className:cls,createdAt:Date.now(),version:5}:undefined,{applyLocally:false});
   if(!r.committed){say('這個課堂代碼已存在，請換一個（歷史資料不會被覆蓋）');return}
   say('✅ 新課堂已建立：'+code+'。請告訴學生課堂代碼。');$('lessonSelect').value=code;selectLesson(code);
   }catch(e){say('建立失敗：'+(e.code||e.message))}
 };
 function clearSubscriptions(){if(unsubscribeStudents){unsubscribeStudents();unsubscribeStudents=null}if(unsubscribeGroups){unsubscribeGroups();unsubscribeGroups=null}if(unsubscribeConfig){unsubscribeConfig();unsubscribeConfig=null}}
 function selectLesson(code){clearSubscriptions();selected=code;records={};groupKeys={};fiveGroups={};renderFive();render();if(!code){$('lessonInfo').textContent='尚未選擇課堂';return}
 $('lessonInfo').textContent=`目前：${meta[code]?.className||''}｜代碼 ${code}｜建立日期 ${meta[code]?.createdAt?new Date(meta[code].createdAt).toLocaleString('zh-TW'):''}`;
 unsubscribeStudents=onValue(ref(db,`adventureSessions/${code}/students`),s=>{records=s.val()||{};render()},e=>say('🔴 學生紀錄讀取失敗：'+e.code));
 unsubscribeGroups=onValue(ref(db,`adventureSessions/${code}/groupKeys`),s=>{groupKeys=s.val()||{};render()},e=>say('🔴 小組紀錄讀取失敗：'+e.code));
 unsubscribeConfig=onValue(ref(db,`adventureSessions/${code}/meta/fivePersonGroups`),s=>{fiveGroups=s.val()||{};renderFive();render()},e=>say('🔴 五人組設定讀取失敗：'+e.code));
 }
 onAuthStateChanged(auth,u=>{clearSubscriptions();if(!isTeacher(u)){$('dashboard').hidden=true;say(u?'請使用原本的教師Google帳號登入':'請登入教師Google帳號');return} $('dashboard').hidden=false;say('🟢 教師已登入。請選擇或建立課堂。');onValue(ref(db,'adventureSessions'),snap=>{const data=snap.val()||{},prev=selected;meta={};const opts=['<option value="">選擇課堂</option>'];for(const [code,x] of Object.entries(data)){if(!x.meta||x.meta.version!==5)continue;meta[code]=x.meta;opts.push(`<option value="${esc(code)}">${esc(x.meta.className||'未命名')}｜${esc(code)}</option>`)}$('lessonSelect').innerHTML=opts.join('');$('lessonSelect').value=prev&&meta[prev]?prev:'';if(prev&&!meta[prev])selectLesson('');},e=>say('讀取課堂清單失敗：'+e.code));});
 $('exportCSV').onclick=()=>{if(!selected){say('請先選擇課堂');return}const rows=[['課堂','班級','學生代號','組別','四島完成數','音符','知識題完成','重試次數','角色','選擇BGM','音樂證據','情緒','離場券答對數','離場券作答數','更新時間']];for(const v of Object.values(records)){rows.push([selected,meta[selected]?.className||'',v.nickname||'',v.group||'',(v.done||[]).filter(Boolean).length,v.coins||0,v.knowledgeCorrect||0,(v.knowledgeRetries||[]).reduce((a,b)=>a+(+b||0),0),roles[v.role]||'',v.song||'',(v.traits||[]).join('、'),v.feeling||'',(v.exit||[]).filter(a=>a.correct).length,(v.exit||[]).length,v.updatedAt?new Date(v.updatedAt).toLocaleString('zh-TW'):''])}
 for(const [g,d] of Object.entries(groupKeys)){const rs=['tone','tempo','feeling','director',...(fiveGroups[g]?['advisor']:[])];if(!rs.some(r=>d[r]))continue;rows.push([selected,meta[selected]?.className||'','【小組成果】',g,rs.filter(r=>d[r]).length,'','','','',d.final?.song||'',rs.filter(r=>d[r]).map(r=>roles[r]+':'+d[r].trait).join('；'),'', '', '', ''])}
 const csv='\uFEFF'+rows.map(a=>a.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`延和音樂島_${selected}_紀錄.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);};
function renderFive(){$('fiveGroups').querySelectorAll('[data-five]').forEach(c=>c.checked=!!fiveGroups[c.dataset.five]);$('fiveState').textContent=selected?'已載入本堂設定':'請先選擇課堂';}
function render(){const all=Object.values(records).filter(v=>v&&typeof v==='object'),n=all.length;$('n').textContent=n;[0,2,3].forEach((stage,i)=>$( ['l1','l3','l4'][i]).textContent=all.filter(v=>Array.isArray(v.done)&&v.done[stage]).length+' / '+n);
$('stats').innerHTML=['💗 情緒森林','🎼 節奏山谷','🏰 配樂城堡','🏆 離場挑戰'].map((name,i)=>{let count=all.filter(v=>Array.isArray(v.done)&&v.done[i]).length;return `<p><b>${name}</b>：${count} / ${n}　<span class="pill">${n?Math.round(count/n*100):0}%</span></p>`}).join('');
const exits=[0,1,2].map(i=>({count:all.filter(v=>v.exit?.[i]).length,correct:all.filter(v=>v.exit?.[i]?.correct).length}));
$('learning').innerHTML=`<p>第二關完成全部3題：<b>${all.filter(v=>v.knowledgeCorrect===3).length}/${n}</b></p><p>第二關累計答錯重試：<b>${all.reduce((s,v)=>s+(v.knowledgeRetries||[]).reduce((a,b)=>a+(Number(b)||0),0),0)}</b>次</p>`+exits.map((x,i)=>`<p>離場券第${i+1}題：已答 ${x.count} 人，答對 ${x.correct} 人，正確率 ${x.count?Math.round(x.correct/x.count*100):0}%</p>`).join('');
let groupLines=[];for(let i=1;i<=8;i++){let members=all.filter(v=>v.group===String(i)),votes={};members.forEach(m=>{if(m.song)votes[m.song]=(votes[m.song]||0)+1});let sample=members.filter(m=>m.groupAgreed&&m.song).map(m=>`${esc(m.nickname||'未填代號')}（${esc(roles[m.role]||'未選角色')}）：${esc(m.song)}版 / ${esc((m.traits||[]).join('、'))} / ${esc(m.feeling)}`).slice(0,5);groupLines.push(`<tr><td>第${i}組</td><td>${members.length}人</td><td>${esc(Object.entries(votes).map(([k,v])=>k+':'+v).join('、')||'—')}</td><td>${sample.join('<div style="margin:6px 0"></div>')||'未提交共識'}</td></tr>`)}
$('groups').innerHTML='<p class="mini muted">每組由4人或5人領取不同鑰匙（依教師設定）；廣告導演統整小組BGM。</p><table><tr><th>組別</th><th>鑰匙進度</th><th>已完成角色</th><th>最後配樂</th></tr>'+Array.from({length:8},(_,i)=>{const d=groupKeys[String(i+1)]||{};const rs=['tone','tempo','feeling','director',...(fiveGroups[String(i+1)]?['advisor']:[])];const rolesHere=rs.filter(r=>d[r]);const unique=rolesHere.length===rs.length&&new Set(rolesHere.map(r=>d[r].uid)).size===rs.length;return `<tr><td>第${i+1}組</td><td>${rolesHere.length}/${rs.length}</td><td>${rolesHere.map(r=>esc(roles[r])).join('、')||'—'}</td><td>${unique&&d.final?esc(d.final.song)+'版 🏰 已解鎖':'🔒 未解鎖'}</td></tr>`}).join('')+'</table>';
const filter=$('filter').value,visible=all.filter(v=>filter==='all'||v.group===filter);$('studentRows').innerHTML=visible.map(v=>`<tr><td>${esc(v.nickname||'未填')}</td><td>${esc(v.group||'—')}</td><td>${(v.done||[]).filter(Boolean).length}/4</td><td>${Number(v.knowledgeCorrect)||0}/3</td><td>${(v.knowledgeRetries||[]).reduce((a,b)=>a+(Number(b)||0),0)}</td><td>${esc(v.song||'—')}</td><td>${(v.exit||[]).filter(q=>q?.correct).length}/${(v.exit||[]).length}</td><td>${v.updatedAt?'已同步':'待同步'}</td></tr>`).join('')||'<tr><td colspan="8">尚無學生紀錄</td></tr>';
}

}catch(e){console.error(e);say('程式載入失敗：'+(e.code||e.message))}
