(function(){
'use strict';
const E=ExpenseEngine,$=id=>document.getElementById(id),KEY='my-expenses-v1';
const API='https://coggpgbxkswlpuvqvtky.supabase.co/functions/v1/personal-expenses';
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
let state=E.empty(),area='personal',month=today().slice(0,7),editing=null,deleted=null,readOnly=true,limitCategory=null;
const names={personal:'Личное',business:'Бизнес'};
const rub=n=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:n%100?2:0}).format(n/100);
const monthName=m=>new Date(m+'-15T12:00:00').toLocaleDateString('ru-RU',{month:'long',year:'numeric'}).replace(' г.','').replace(/^./,c=>c.toUpperCase());
const escape=E.escapeHTML;
// Session credentials and expenses exist only in this page's memory.
let token=null,expiresAt=0,expiryTimer=null,generation=0,loggingIn=false;
let revision=0,saving=false,ready=false,refreshing=false,refreshPromise=null,needsReconcile=false;
const requests=new Set();
const sessionEnded=()=>Object.assign(Error('Сессия завершилась. Введите PIN снова.'),{code:'session_ended'});
const active=g=>token!==null&&g===generation&&Date.now()<expiresAt;
function toast(text,undo=false){if(!token)return;$('toastText').textContent=text;$('undo').hidden=!undo;$('toast').hidden=false;}
function cover(){if(!token)return;document.body.classList.add('privacy-covered');$('privateApp').inert=true;}
function uncover(){if(!token||!ready||document.visibilityState==='hidden')return;document.body.classList.remove('privacy-covered');$('privateApp').inert=false;}
function clearPrivateView(){
 state=E.empty();revision=0;ready=false;deleted=null;editing=null;limitCategory=null;importCandidate=null;
 area='personal';month=today().slice(0,7);
 $('toast').hidden=true;$('toastText').textContent='';$('exportData').disabled=true;
 document.querySelectorAll('dialog[open]').forEach(d=>d.close());
 document.querySelectorAll('#privateApp input').forEach(i=>{i.value='';i.checked=false;});
 ['category','categoryChoices','importSource','importPreview','formArea','limitContext','categoryArea','formError','categoryError','limitError','importError'].forEach(id=>{$(id).textContent='';});
 $('commentDetails').open=false;render();
}
function setSaving(value){
 saving=value;
 const disabled=value||readOnly||refreshing||!ready||!token;
 document.querySelectorAll('#privateApp button[type="submit"],#privateApp form button.primary,#addExpense,#newCategory,#editLimit,#deleteExpense,#undo,#importData,#importBrowserData,#formAddCategory').forEach(el=>el.disabled=disabled);
}
function lock(message=''){
 generation++;token=null;expiresAt=0;clearTimeout(expiryTimer);expiryTimer=null;
 requests.forEach(c=>c.abort());requests.clear();
 saving=false;refreshing=false;refreshPromise=null;readOnly=true;loggingIn=false;needsReconcile=false;
 $('privateApp').hidden=true;$('privateApp').inert=true;
 document.body.classList.add('is-locked');document.body.classList.remove('privacy-covered');
 clearPrivateView();setSaving(false);
 $('loginPanel').hidden=false;$('pin').value='';$('pin').disabled=false;$('loginButton').disabled=false;
 $('loginButton').textContent='Открыть расходы';$('loginMessage').textContent=message;
}
function assertSession(g){if(!active(g)){if(g===generation)lock('Сессия завершилась. Введите PIN снова.');throw sessionEnded();}}
async function request(path,options={},sessionToken=null){
 const controller=new AbortController();requests.add(controller);
 const timer=setTimeout(()=>controller.abort(),15000);
 try{return await fetch(API+path,{...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(sessionToken?{'Authorization':'Bearer '+sessionToken}:{}),...options.headers},credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',redirect:'error',signal:controller.signal});}
 finally{clearTimeout(timer);requests.delete(controller);}
}
function retryHint(res){const raw=res.headers?.get('Retry-After');if(!raw)return 'Попробуйте позже.';const seconds=/^\d+$/.test(raw)?Number(raw):Math.ceil((Date.parse(raw)-Date.now())/1000);if(!Number.isFinite(seconds)||seconds<=0)return 'Попробуйте позже.';return seconds<3600?'Попробуйте через '+Math.max(1,Math.ceil(seconds/60))+' мин.':'Попробуйте через '+Math.ceil(seconds/3600)+' ч.';}
function showReload(message){readOnly=true;needsReconcile=true;$('storageMessage').textContent=message;document.querySelectorAll('.reload-sync').forEach(el=>el.hidden=false);setSaving(false);}
function snapshot(data){if(!data||!Number.isSafeInteger(data.revision)||data.revision<0)throw Error('Некорректный ответ сервера.');return E.validate(data.state);}
function scheduleExpiry(){clearTimeout(expiryTimer);expiryTimer=setTimeout(()=>{if(token&&Date.now()>=expiresAt)lock('Сессия завершилась. Введите PIN снова.');else if(token)scheduleExpiry();},Math.min(Math.max(0,expiresAt-Date.now()),2147483647));}
function refreshCloud(){
 if(!token)return Promise.resolve(false);
 if(refreshPromise)return refreshPromise;
 if(saving)return Promise.resolve(false);
 const g=generation;
 if(!active(g)){lock('Сессия завершилась. Введите PIN снова.');return Promise.resolve(false);}
 refreshing=true;cover();setSaving(false);
 const job=(async()=>{try{
  const res=await request('/state',{},token);assertSession(g);
  if(res.status===401||res.status===403){lock('Сессия завершилась. Введите PIN снова.');return false;}
  if(!res.ok)throw Error(res.status===429?'Слишком много запросов. Подождите немного и войдите снова.':'Не удалось загрузить расходы. Проверьте интернет и войдите снова.');
  const data=await res.json();assertSession(g);const clean=snapshot(data);
  if(needsReconcile){document.querySelectorAll('dialog[open]').forEach(d=>d.close());importCandidate=null;deleted=null;}
  if(!document.querySelector('dialog[open]')&&data.revision>=revision){state=clean;revision=data.revision;render();}
  ready=true;readOnly=false;needsReconcile=false;
  document.querySelectorAll('.reload-sync').forEach(el=>el.hidden=true);
  $('exportData').disabled=false;
  $('storageMessage').textContent=revision===0?'Учёт пока пуст. Старые записи не переносятся автоматически: при необходимости используйте «Настройки».':'Сохранено в вашем защищённом хранилище. Данные общие для телефона и компьютера; для изменений нужен интернет.';
  $('loginPanel').hidden=true;$('privateApp').hidden=false;document.body.classList.remove('is-locked');
  uncover();return true;
 }catch(err){if(g===generation)lock(err.code==='session_ended'?'Сессия завершилась. Введите PIN снова.':'Не удалось проверить доступ к расходам. Проверьте интернет и войдите снова.');return false;}
 finally{if(g===generation){refreshing=false;refreshPromise=null;setSaving(saving);uncover();}}})();
 refreshPromise=job;return job;
}
$('pin').addEventListener('input',()=>{$('pin').value=$('pin').value.replace(/[^0-9]/g,'').slice(0,4);});
$('loginForm').addEventListener('submit',async e=>{
 e.preventDefault();if(loggingIn)return;
 let pin=$('pin').value;$('pin').value='';
 if(!/^[0-9]{4}$/.test(pin)){pin=null;$('loginMessage').textContent='Введите ровно 4 цифры.';return;}
 const g=generation;loggingIn=true;$('pin').disabled=true;$('loginButton').disabled=true;$('loginButton').textContent='Проверяем…';$('loginMessage').textContent='';
 try{
  const pending=request('/login',{method:'POST',body:JSON.stringify({pin})});pin=null;
  const res=await pending;if(g!==generation)return;
  if(!res.ok){$('loginMessage').textContent=res.status===429?'Слишком много попыток. '+retryHint(res):res.status===401?'Не удалось войти. Проверьте PIN.':'Вход сейчас недоступен. Попробуйте позже.';return;}
  const data=await res.json();if(g!==generation)return;
  const until=typeof data.expiresAt==='string'?Date.parse(data.expiresAt):NaN;
  if(typeof data.token!=='string'||data.token.length<32||data.token.length>2048||!Number.isFinite(until)||until<=Date.now())throw Error('invalid response');
  token=data.token;expiresAt=until;scheduleExpiry();await refreshCloud();
 }catch{if(g===generation)lock('Не удалось войти. Проверьте интернет и попробуйте снова.');}
 finally{pin=null;if(g===generation){loggingIn=false;$('pin').disabled=false;$('loginButton').disabled=false;$('loginButton').textContent='Открыть расходы';}}
});
$('logout').onclick=()=>{const oldToken=token;lock('На этом устройстве доступ закрыт.');const g=generation;if(oldToken)request('/logout',{method:'POST'},oldToken).then(res=>{if(!res.ok&&res.status!==401)throw Error('logout unavailable');}).catch(()=>{if(g===generation&&!token)$('loginMessage').textContent='На этом устройстве доступ закрыт. Сервер не подтвердил завершение сессии.';});};
async function commit(next){
 const g=generation;assertSession(g);
 if(readOnly||!ready||refreshing)throw Error('Дождитесь проверки облачных данных.');
 if(saving)throw Error('Дождитесь предыдущего сохранения.');
 const clean=E.validate(next),body=JSON.stringify({state:clean,expectedRevision:revision,operationId:crypto.randomUUID()});
 if(new TextEncoder().encode(body).length>1024*1024)throw Error('Слишком много данных (лимит 1 МБ). Сохраните копию.');
 setSaving(true);
 try{
  let res;
  // Retrying is safe only with the same operationId and exact same body.
  for(let attempt=0;attempt<2;attempt++){
   assertSession(g);
   try{res=await request('/state',{method:'PUT',body},token);assertSession(g);if(res.status<500)break;}
   catch(err){if(err.code==='session_ended'||g!==generation)throw sessionEnded();}
  }
  assertSession(g);
  if(!res||res.status>=500){showReload('Статус сохранения неизвестен. Обновите и проверьте историю, прежде чем повторять запись.');throw Error('Не удалось подтвердить сохранение. Обновите и проверьте историю: повторная запись может оказаться лишней.');}
  if(res.status===401||res.status===403){lock('Сессия завершилась. Войдите заново и проверьте историю.');throw sessionEnded();}
  let data;try{data=await res.json();}catch{showReload('Ответ сервера не прочитан. Обновите и проверьте историю.');throw Error('Статус сохранения неизвестен. Обновите и проверьте историю.');}
  assertSession(g);
  if(res.status===409){
   if(data.state){state=snapshot(data);revision=data.revision;render();}
   else{showReload('Данные изменились. Обновите и проверьте историю.');}
   throw Object.assign(Error('Данные изменились на другом устройстве. Обзор обновлён; проверьте введённые значения и сохраните ещё раз.'),{code:'revision_conflict'});
  }
  if(!res.ok)throw Error(res.status===429?'Слишком много запросов. '+retryHint(res):res.status===413?'Файл слишком большой.':'Не удалось сохранить изменения. Проверьте поля и повторите.');
  try{state=snapshot(data);revision=data.revision;}catch{showReload('Не удалось проверить ответ сохранения. Обновите и проверьте историю.');throw Error('Статус сохранения неизвестен.');}
  render();$('storageMessage').textContent='Изменения сохранены. На другом устройстве они появятся при открытии приложения.';
 }finally{if(g===generation){setSaving(false);if(document.visibilityState==='visible'){if(!readOnly)refreshCloud();else uncover();}}}
}
window.addEventListener('blur',cover);
window.addEventListener('focus',()=>{if(token){cover();refreshCloud();}});
window.addEventListener('pagehide',()=>lock());
window.addEventListener('pageshow',e=>{if(e.persisted)lock();else if(token){cover();refreshCloud();}});
document.addEventListener('visibilitychange',()=>{if(token){cover();if(document.visibilityState==='visible')refreshCloud();}});
document.querySelectorAll('.reload-sync').forEach(b=>b.onclick=()=>location.reload());
const chartColors=['#951b37','#ed7967','#e8b35e','#bbb1b1','#6a8b83','#687ba1','#9e73a1','#98775c'];
function categoryIcon(name){const n=name.toLowerCase();let shape='<circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/>';if(/дом|кварт|жиль|home/.test(n))shape='<path d="M3 11l9-8 9 8M6 10v11h5v-7h3v7h5V10"/>';else if(/авто|машин|транспорт|такси|car/.test(n))shape='<path d="M4 10l2-6h12l2 6M3 10h18v9H3zM6 19v2M18 19v2"/><circle cx="7" cy="14" r="1"/><circle cx="17" cy="14" r="1"/>';else if(/продукт|еда|food|питани/.test(n))shape='<path d="M3 8h18l-2 12H5L3 8zM7 8l3-6M17 8l-3-6M8 12v4M12 12v4M16 12v4"/>';else if(/кафе|коф|ресторан|cafe/.test(n))shape='<path d="M4 4h13v10a6 6 0 01-12 0L4 4zM17 5h3a3 3 0 010 6h-3M3 21h17"/>';else if(/покуп|одеж|шоп|shop/.test(n))shape='<path d="M5 8h14l2 13H3L5 8zM8 8V5a4 4 0 018 0v3"/>';else if(/работ|бизнес|work/.test(n))shape='<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12h18M10 12v3h4v-3"/>';else if(/здоров|аптек|мед/.test(n))shape='<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>';return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shape}</svg>`;}
function pct(n){return n===null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(n)+'%';}
function renderReport(){const r=E.report(state,month,area);$('reportContext').textContent=monthName(month)+' · '+names[area];$('reportBudgetLabel').textContent=!r.complete?'Не все лимиты категорий заданы':r.planned===0?'На месяц задан нулевой бюджет':'Использовано '+pct(r.budgetUsed)+' общего бюджета';$('reportBudgetNumbers').textContent=r.complete?rub(r.spent)+' из '+rub(r.planned):rub(r.spent)+' потрачено';$('reportBudgetBar').style.width=(r.percent??0)+'%';$('reportBudgetRemaining').textContent=r.remaining===null?'Общий остаток появится, когда все лимиты будут заданы.':r.remaining<0?'Лимит превышен на '+rub(-r.remaining):'Осталось '+rub(r.remaining);$('reportBudgetRemaining').classList.toggle('over-alert',r.remaining!==null&&r.remaining<0);$('donutChart').hidden=r.spent===0;$('reportEmpty').hidden=r.spent!==0;$('donutTotal').textContent=rub(r.spent);let start=0;const segments=[];r.items.forEach((item,i)=>{if(item.spent>0){const end=start+item.spent/r.spent*100;segments.push(`${chartColors[i%chartColors.length]} ${start}% ${end}%`);start=end;}});$('donutChart').style.background=segments.length?'conic-gradient('+segments.join(',')+')':'#e9e4e0';$('donutChart').setAttribute('aria-label','Доли расходов за '+monthName(month)+'. Всего '+rub(r.spent)+'. Подробности в списке ниже.');$('reportRows').innerHTML=r.items.map((item,i)=>`<div class="report-row"><span class="report-category"><i style="background:${chartColors[i%chartColors.length]}"></i><span>${escape(item.name)}<small>${rub(item.spent)}</small></span></span><span>${pct(item.expenseShare)}</span><span>${pct(item.budgetShare)}</span></div>`).join('');$('reportFootnote').textContent='Доля расходов = траты категории ÷ все траты месяца. Доля бюджета = траты категории ÷ общий бюджет раздела.'+(!r.complete?' Общий бюджет не полностью задан: его доли не рассчитываются.':r.planned===0?' При нулевом бюджете процент от бюджета не рассчитывается.':'')+(r.spent===0?' Без расходов доли расходов не рассчитываются.':'');}
function render(){const s=E.summary(state,month,area);$('month').value=month;$('monthTitle').textContent=monthName(month);document.querySelectorAll('[data-area]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.area===area)));$('areaCaption').textContent=area==='personal'?'Ваши траты на личную жизнь.':'Только то, что вы сами тратите на работу.';$('spent').textContent=rub(s.spent);$('budgetTotal').textContent=s.complete||s.assigned>0?rub(s.planned):'—';$('limitLabel').textContent=s.complete?'Общий бюджет '+rub(s.planned):'Задано по категориям '+rub(s.planned);$('editLimit').textContent='Настроить';$('budgetStatus').textContent=s.complete?'Сумма лимитов всех категорий':`Не все лимиты заданы (${s.assigned} из ${s.categoryCount}).`; $('legacyBudget').textContent=s.legacyLimit===null?'':`Прежний общий лимит: ${rub(s.legacyLimit)}. Сохранён для справки, по категориям не распределён.`;$('bar').style.width=(s.percent??0)+'%';$('remaining').textContent=s.remaining===null?'Задайте лимиты категорий':s.remaining<0?'Лимит превышен на '+rub(-s.remaining):'Осталось '+rub(s.remaining);$('remaining').classList.toggle('over-alert',s.remaining!==null&&s.remaining<0);const cats=state.categories.filter(c=>c.area===area);$('categories').innerHTML=cats.map((c,i)=>{const b=E.categorySummary(state,month,c.id),exceeded=b.remaining!==null&&b.remaining<0,progress=b.limit===null?0:b.limit===0?(b.spent>0?100:0):Math.min(100,b.spent/b.limit*100);return `<div class="category-tile ${exceeded?'exceeded':''}" data-category-row="${escape(c.id)}"><button type="button" class="tile-main" data-budget="${escape(c.id)}"><span class="tile-heading">${categoryIcon(c.name)}<span>${escape(c.name)}</span></span><span class="tile-amount"><b>${rub(b.spent)}</b><span> / ${b.limit===null?'не задан':rub(b.limit)}</span></span><span class="tile-progress"><span style="width:${progress}%"></span></span><span class="tile-status ${exceeded?'over-alert':''}">${exceeded?'Лимит превышен на '+rub(-b.remaining):b.limit===null?'Задать лимит': 'Осталось '+rub(b.remaining)}</span></button><div class="tile-order"><button type="button" class="drag-handle" data-drag="${escape(c.id)}" aria-label="Переместить ${escape(c.name)}: удерживайте и перетащите">⠿</button><button data-up="${escape(c.id)}" ${i===0?'disabled':''} aria-label="${escape(c.name)}: выше">↑</button><button data-down="${escape(c.id)}" ${i===cats.length-1?'disabled':''} aria-label="${escape(c.name)}: ниже">↓</button></div></div>`;}).join('')+'<button type="button" class="category-tile add-tile" data-new-category><span aria-hidden="true">＋</span>Добавить категорию</button>' ;$('count').textContent=s.rows.length+' записей';$('expenses').innerHTML=s.rows.length?[...s.rows].sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)).map(e=>`<button class="row" data-edit="${escape(e.id)}" aria-label="Изменить расход: ${escape(state.categories.find(c=>c.id===e.category).name)}, ${escape(rub(e.amount))}"><span><span class="title">${escape(state.categories.find(c=>c.id===e.category).name)}</span><small>${new Date(e.date+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}${e.note?' · '+escape(e.note):''}</small></span><span class="value">${rub(e.amount)} ›</span></button>`).join(''):'<div class="empty"><b>Здесь пока спокойно</b>В этом месяце ещё нет расходов.<br>Добавьте первый, когда будете готовы.</div>';renderReport();}
function openExpense(id=null){if(!token||readOnly||saving||refreshing)return;editing=id;const e=state.expenses.find(x=>x.id===id);$('formTitle').textContent=e?'Изменить расход':'Новый расход';$('formArea').textContent=names[area];$('amount').value=e?String(e.amount/100).replace('.',','):'';fillCategories(e?.category);$('date').value=e?e.date:today();$('note').value=e?.note||'';$('commentDetails').open=!!e?.note;$('formError').textContent='';$('deleteExpense').hidden=!e;$('expenseDialog').showModal();$('amount').focus();}
function fillCategories(selected){const cats=state.categories.filter(c=>c.area===area);$('category').innerHTML='<option value="">Выберите категорию</option>'+cats.map(c=>`<option value="${escape(c.id)}">${escape(c.name)}</option>`).join('');if(selected)$('category').value=selected;else if(cats.length===1)$('category').value=cats[0].id;const value=$('category').value;$('categoryChoices').innerHTML=cats.map(c=>`<label class="category-choice"><input type="radio" name="expenseCategory" value="${escape(c.id)}" ${value===c.id?'checked':''}><span>${categoryIcon(c.name)}<span>${escape(c.name)}</span></span></label>`).join('')||'<p class="muted">Добавьте первую категорию ниже.</p>';}
$('categoryChoices').onchange=e=>{if(e.target.name==='expenseCategory')$('category').value=e.target.value;};

function newCategory(){if(!token||readOnly||saving||refreshing)return;$('categoryName').value='';$('newCategoryLimit').value='';$('categoryArea').textContent=names[area]+' · '+monthName(month);$('categoryError').textContent='';$('categoryDialog').showModal();$('categoryName').focus();}
$('previousMonth').onclick=()=>{month=E.shiftMonth(month,-1);render();};
$('nextMonth').onclick=()=>{month=E.shiftMonth(month,1);render();};
$('currentMonth').onclick=()=>{month=today().slice(0,7);render();};
$('month').onchange=e=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)){month=e.target.value;render();}};
document.querySelectorAll('[data-area]').forEach(b=>b.onclick=()=>{area=b.dataset.area;render();});
$('newCategory').onclick=newCategory;$('formAddCategory').onclick=newCategory;$('addExpense').onclick=()=>openExpense();
$('expenses').onclick=e=>{const b=e.target.closest('[data-edit]');if(b)openExpense(b.dataset.edit);};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('categoryForm').onsubmit=async e=>{e.preventDefault();try{const name=$('categoryName').value.trim();if(!name)throw Error('Введите название категории.');if(state.categories.some(c=>c.area===area&&c.name.toLocaleLowerCase('ru')===name.toLocaleLowerCase('ru')))throw Error('Такая категория уже есть.');const id=crypto.randomUUID();const categoryLimits={...state.categoryLimits};if($('newCategoryLimit').value.trim()!=='')categoryLimits[month+':'+id]=E.money($('newCategoryLimit').value);await commit({...state,categoryLimits,categories:[...state.categories,{id,name,area}]});$('categoryDialog').close();if($('expenseDialog').open)fillCategories(id);toast('Категория добавлена.');}catch(err){$('categoryError').textContent=err.message;$('categoryError').focus();}};
$('expenseForm').onsubmit=async e=>{e.preventDefault();try{const amount=E.money($('amount').value);if(amount<=0)throw Error('Расход должен быть больше нуля.');if(!$('category').value)throw Error('Добавьте или выберите категорию.');const date=$('date').value;if(!E.dateValid(date))throw Error('Выберите корректную дату.');const wasEdit=!!editing;await commit(E.saveExpense(state,{id:editing||crypto.randomUUID(),amount,category:$('category').value,date,note:$('note').value.trim(),area}));month=date.slice(0,7);render();$('expenseDialog').close();toast(wasEdit?'Расход изменён.':'Расход сохранён.');}catch(err){$('formError').textContent=err.message;$('formError').focus();}};
$('deleteExpense').onclick=async ()=>{try{const item=state.expenses.find(e=>e.id===editing);await commit(E.removeExpense(state,editing));deleted=item;$('expenseDialog').close();toast('Расход удалён. Можно отменить.',true);}catch(err){$('formError').textContent=err.message;$('formError').focus();}};
$('undo').onclick=async ()=>{if(!deleted)return;try{await commit(E.saveExpense(state,deleted));deleted=null;toast('Расход восстановлен.');}catch(err){toast(err.message,true);}};
$('dismissToast').onclick=()=>{$('toast').hidden=true;};
function editCategoryLimit(id){if(!token||readOnly||saving||refreshing)return;limitCategory=id;const c=state.categories.find(c=>c.id===id);$('limitContext').textContent=c.name+' · '+monthName(month)+' · '+names[area];const v=state.categoryLimits?.[month+':'+id];$('limitAmount').value=v===undefined?'':String(v/100).replace('.',',');$('limitError').textContent='';$('limitDialog').showModal();$('limitAmount').focus();}
$('editLimit').onclick=()=>{const first=state.categories.find(c=>c.area===area);if(first)editCategoryLimit(first.id);else newCategory();};
$('limitForm').onsubmit=async e=>{e.preventDefault();try{const categoryLimits={...state.categoryLimits},v=$('limitAmount').value.trim();if(v==='')delete categoryLimits[month+':'+limitCategory];else categoryLimits[month+':'+limitCategory]=E.money(v);await commit({...state,categoryLimits});$('limitDialog').close();toast('Лимит категории сохранён для выбранного месяца.');}catch(err){$('limitError').textContent=err.message;$('limitError').focus();}};
async function reorder(id,target){try{await commit(E.moveCategory(state,id,target));toast('Порядок категорий сохранён.');}catch(err){toast(err.message);}}
$('categories').onclick=async e=>{if(e.target.closest('[data-new-category]')){if(!readOnly&&!saving)newCategory();return;}const budget=e.target.closest('[data-budget]');if(budget){editCategoryLimit(budget.dataset.budget);return;}const btn=e.target.closest('[data-up],[data-down]');if(!btn)return;const id=btn.dataset.up||btn.dataset.down,cats=state.categories.filter(c=>c.area===area),i=cats.findIndex(c=>c.id===id),target=cats[i+(btn.dataset.up?-1:1)];if(target){await reorder(id,target.id);document.querySelector(`[data-${btn.dataset.up?'up':'down'}="${CSS.escape(id)}"]`)?.focus();}};
let dragging=null,holdTimer=null;
$('categories').addEventListener('pointerdown',e=>{const handle=e.target.closest('[data-drag]');if(!handle||readOnly||saving||e.button!==0)return;const id=handle.dataset.drag;dragging={id,target:id,ready:e.pointerType==='mouse'};handle.setPointerCapture(e.pointerId);if(dragging.ready)handle.classList.add('dragging');else holdTimer=setTimeout(()=>{if(dragging){dragging.ready=true;handle.classList.add('dragging');}},300);});
document.addEventListener('pointermove',e=>{if(!dragging?.ready)return;e.preventDefault();const row=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-category-row]');if(row){dragging.target=row.dataset.categoryRow;document.querySelectorAll('[data-category-row]').forEach(r=>r.classList.toggle('drop-target',r===row));}},{passive:false});
function finishDrag(cancel=false){clearTimeout(holdTimer);const d=dragging;dragging=null;document.querySelectorAll('.dragging,.drop-target').forEach(el=>el.classList.remove('dragging','drop-target'));if(!cancel&&d?.ready&&d.id!==d.target)reorder(d.id,d.target);}
document.addEventListener('pointerup',()=>finishDrag());document.addEventListener('pointercancel',()=>finishDrag(true));

function panel(view){$('settingsPanel').hidden=view!=='settings';$('historyPanel').hidden=view!=='history';$('reportPanel').hidden=view!=='report';document.querySelector('.overview').classList.toggle('compact',view!=='overview');['overviewTab','historyTab','reportTab','settingsTab'].forEach(id=>{$(id).classList.remove('active');$(id).removeAttribute('aria-current');});const id={overview:'overviewTab',history:'historyTab',report:'reportTab',settings:'settingsTab'}[view];$(id).classList.add('active');$(id).setAttribute('aria-current','page');document.querySelector('.detail').hidden=view==='overview';if(view==='overview')document.querySelector('.overview').scrollIntoView({behavior:'smooth',block:'start'});else document.querySelector('.detail').scrollIntoView({behavior:'smooth',block:'start'});}
$('historyTab').onclick=()=>panel('history');$('overviewTab').onclick=()=>panel('overview');$('reportTab').onclick=()=>panel('report');$('settingsTab').onclick=()=>panel('settings');

$('exportData').onclick=()=>{if(!token||!ready)return;const blob=new Blob([JSON.stringify(state)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='moi-rashody-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Файл подготовлен. Проверьте загрузки.');};
let importCandidate=null;
function previewImport(data,source){if(!token||!ready||readOnly||saving)return;importCandidate=data;$('importSource').textContent=source+' Эти данные не привязаны к подтверждённому владельцу. Продолжайте только если это ваши записи.';$('importPreview').textContent=`Будет импортировано: ${data.expenses.length} расходов, ${data.categories.length} категорий, всего ${rub(data.expenses.reduce((n,e)=>n+e.amount,0))}. Сейчас в облаке: ${state.expenses.length} расходов. Облачные данные будут заменены на всех устройствах.`;$('confirmImportOwner').checked=false;$('confirmImportBackup').checked=false;$('importError').textContent='';if(!$('importDialog').open)$('importDialog').showModal();}
$('importData').onchange=async e=>{const g=generation;try{if(!token||!ready||readOnly)return;const file=e.target.files[0];if(!file)return;if(file.size>1024*1024)throw Error('Файл слишком большой (максимум 1 МБ).');const contents=await file.text();if(!active(g))return;previewImport(E.validate(JSON.parse(contents)),'Файл: '+file.name+'.');}catch(err){toast('Не удалось прочитать файл: '+err.message);}finally{e.target.value='';}};
$('importBrowserData').onclick=()=>{if(!token||!ready||readOnly||saving||refreshing)return;try{const raw=localStorage.getItem(KEY);if(!raw){toast('В этом браузере нет записей первой версии.');return;}previewImport(E.validate(JSON.parse(raw)),'Записи первой версии из этого браузера.');}catch(err){toast('Данные браузера не прочитаны: '+err.message);}};
$('backupBeforeImport').onclick=()=>$('exportData').click();
$('importForm').onsubmit=async e=>{e.preventDefault();try{if(!importCandidate||!$('confirmImportOwner').checked||!$('confirmImportBackup').checked)throw Error('Подтвердите принадлежность данных и резервную копию.');await commit(importCandidate);importCandidate=null;deleted=null;$('importDialog').close();toast('Импорт сохранён в облаке. Исходный файл и записи браузера не удалены.');}catch(err){if(err.code==='revision_conflict'){previewImport(importCandidate,'Облачные данные изменились. Проверьте импорт заново.');$('confirmImportBackup').checked=false;}$('importError').textContent=err.message;$('importError').focus();}};

$('importDialog').addEventListener('close',()=>{importCandidate=null;$('importSource').textContent='';$('importPreview').textContent='';$('confirmImportOwner').checked=false;$('confirmImportBackup').checked=false;});
document.querySelector('.detail').hidden=true;
lock();
})();
