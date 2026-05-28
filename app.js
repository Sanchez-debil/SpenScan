// SpenScan — Main Application Script

// DATA
const TX = [
  {abbr:'AW',name:'AWS Cloud Services',cat:'Інфраструктура',date:'3 тра',amount:-16800,st:'ok',ai:''},
  {abbr:'FG',name:'Figma Pro x8',cat:'Дизайн',date:'2 тра',amount:-4480,st:'warn',ai:'3 зайві місця'},
  {abbr:'AC',name:'Acme Corp — оплата',cat:'Дохід',date:'30 кві',amount:128000,st:'ok',ai:''},
  {abbr:'ZM',name:'Zoom Business',cat:'Комунікація',date:'1 тра',amount:-3560,st:'crit',ai:'Дублює Teams'},
  {abbr:'TB',name:'Tableau ліцензія',cat:'Аналітика',date:'29 кві',amount:-5840,st:'warn',ai:'47 днів без входу'},
  {abbr:'SL',name:'Slack Business+',cat:'Комунікація',date:'28 кві',amount:-7500,st:'warn',ai:'Ціна +22%'},
  {abbr:'GW',name:'Google Workspace',cat:'Продуктивність',date:'27 кві',amount:-5760,st:'ok',ai:''},
  {abbr:'BS',name:'Beta Solutions',cat:'Дохід',date:'26 кві',amount:216000,st:'ok',ai:''},
  {abbr:'GH',name:'GitHub Enterprise',cat:'Розробка',date:'25 кві',amount:-8400,st:'ok',ai:''},
  {abbr:'GA',name:'Google Ads',cat:'Маркетинг',date:'24 кві',amount:-16000,st:'ok',ai:''},
];

document.getElementById('ovTx').innerHTML = TX.slice(0,5).map(t=>`<tr>
  <td><div style="display:flex;align-items:center;"><span class="ico">${t.abbr}</span><div><div class="td-name">${t.name}</div><div class="td-cat">${t.cat}</div></div></div></td>
  <td style="color:var(--warm);font-size:11.5px;font-family:'DM Mono',monospace;">${t.date}</td>
  <td class="${t.amount<0?'neg':'pos'}">${t.amount<0?'-':'+'} ₴${Math.abs(t.amount).toLocaleString('uk-UA')}</td>
  <td><span class="chip ${t.st==='ok'?'c-g':t.st==='crit'?'c-r':'c-a'}">${t.st==='ok'?'Норма':t.st==='crit'?'Критично':'Увага'}</span></td>
</tr>`).join('');

document.getElementById('allTx').innerHTML = TX.map((t,i)=>`<tr>
  <td style="color:var(--warm);font-family:'DM Mono',monospace;font-size:11px;">${String(i+1).padStart(3,'0')}</td>
  <td><div style="display:flex;align-items:center;"><span class="ico">${t.abbr}</span><div><div class="td-name">${t.name}</div><div class="td-cat">${t.cat}</div></div></div></td>
  <td><span class="chip c-n">${t.cat}</span></td>
  <td style="color:var(--warm);font-size:11.5px;font-family:'DM Mono',monospace;">${t.date} 2026</td>
  <td class="${t.amount<0?'neg':'pos'}">${t.amount<0?'-':'+'} ₴${Math.abs(t.amount).toLocaleString('uk-UA')}</td>
  <td><span class="chip ${t.st==='ok'?'c-g':t.st==='crit'?'c-r':'c-a'}">${t.st==='ok'?'Норма':t.st==='crit'?'Критично':'Увага'}</span></td>
  <td style="font-size:11px;color:${t.ai?'var(--red)':'var(--warm)'};font-family:'DM Mono',monospace;">${t.ai||'—'}</td>
</tr>`).join('');

document.getElementById('ovAI').innerHTML = `
  <div class="ai-row crit"><div><div class="ai-t">Zoom + Teams — дублювання</div><div class="ai-d">Два інструменти для одних цілей. Скасуй Zoom.</div></div><div class="ai-s">-₴3,560/міс</div></div>
  <div class="ai-row crit"><div><div class="ai-t">Figma — 3 зайві місця</div><div class="ai-d">8 місць, 5 активних. Знизь план.</div></div><div class="ai-s">-₴4,480/міс</div></div>
  <div class="ai-row warn"><div><div class="ai-t">Tableau — 47 днів без активності</div><div class="ai-d">Розглянь скасування або безкоштовну альтернативу.</div></div><div class="ai-s">-₴5,840/міс</div></div>`;

// CHARTS
const days = ['4 кві','8 кві','12 кві','16 кві','20 кві','24 кві','28 кві','2 тра'];
const months = ['чер','лип','сер','вер','жов','лис','гру','січ','лют','бер','кві','тра'];
const tc = '#7A7264'; const gc = 'rgba(28,26,22,.05)';

function mkLine(id, lbs, ds) {
  const el = document.getElementById(id); if(!el) return;
  new Chart(el.getContext('2d'), {type:'line', data:{labels:lbs, datasets:ds},
    options:{responsive:true, plugins:{legend:{labels:{color:tc,font:{family:'DM Sans',size:11}}}},
      scales:{x:{ticks:{color:tc,font:{size:10}},grid:{color:gc}}, y:{ticks:{color:tc,font:{size:10},callback:v=>'₴'+Math.round(v/1000)+'K'},grid:{color:gc}}}}});
}

try { setTimeout(()=>{
  mkLine('mainChart', days, [
    {label:'Дохід',data:[128,164,112,208,156,244,192,228].map(v=>v*1000),borderColor:'#2A6E46',backgroundColor:'rgba(42,110,70,.06)',fill:true,tension:.4,pointRadius:3,pointBackgroundColor:'#2A6E46'},
    {label:'Витрати',data:[72,84,64,96,76,112,88,104].map(v=>v*1000),borderColor:'#B83228',backgroundColor:'rgba(184,50,40,.04)',fill:true,tension:.4,pointRadius:3,pointBackgroundColor:'#B83228'}
  ]);

  const d2 = document.getElementById('donutChart');
  if(d2) new Chart(d2.getContext('2d'), {type:'doughnut',
    data:{labels:['SaaS','Зарплати','Маркетинг','Офіс','Тревел','Інше'],
      datasets:[{data:[28,42,15,8,4,3],backgroundColor:['#1C1A16','#7A7264','#B8A888','#2A6E46','#B83228','#8C5808'],borderWidth:0,hoverOffset:5}]},
    options:{responsive:true,cutout:'63%',plugins:{legend:{position:'bottom',labels:{color:tc,font:{family:'DM Sans',size:11},padding:10}}}}});

  mkLine('cfChart', months, [
    {label:'Надходження',data:[540,620,580,710,660,780,820,760,890,1160,884,996].map(v=>v*1000),borderColor:'#2A6E46',backgroundColor:'rgba(42,110,70,.05)',fill:true,tension:.4,pointRadius:3},
    {label:'Вихідні',data:[240,268,244,292,272,316,328,304,348,452,340,334].map(v=>v*1000),borderColor:'#B83228',backgroundColor:'rgba(184,50,40,.04)',fill:true,tension:.4,pointRadius:3}
  ]);

  const wc = document.getElementById('watChart');
  if(wc) new Chart(wc.getContext('2d'), {type:'bar',
    data:{labels:['Поч.','+Надх.','-Зарп.','-SaaS','-Мрк.','-Ін.','Кін.'],
      datasets:[{data:[1800,996,-140,-93.6,-48,-52,2462].map(v=>v*1000),backgroundColor:['#C8BEA8','#2A6E46','#B83228','#B83228','#B83228','#B83228','#1C1A16'],borderRadius:4}]},
    options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:tc,font:{size:10}},grid:{display:false}},y:{ticks:{color:tc,font:{size:10},callback:v=>'₴'+Math.round(v/1000)+'K'},grid:{color:gc}}}}});

  const ef = document.getElementById('effChart');
  if(ef) new Chart(ef.getContext('2d'), {type:'line',
    data:{labels:months, datasets:[
      {label:'Маржа %',data:[62,65,60,67,63,68,66,63,69,72,68,66],borderColor:'#2A6E46',tension:.4,pointRadius:3,fill:false},
      {label:'Ефективність %',data:[75,78,72,80,76,82,79,74,83,85,80,73],borderColor:'#1C1A16',tension:.4,pointRadius:3,fill:false}
    ]},
    options:{responsive:true,plugins:{legend:{labels:{color:tc,font:{family:'DM Sans',size:11}}}},scales:{x:{ticks:{color:tc,font:{size:10}},grid:{color:gc}},y:{ticks:{color:tc,font:{size:10},callback:v=>v+'%'},grid:{color:gc}}}}});

  const ex = document.getElementById('expChart');
  if(ex) new Chart(ex.getContext('2d'), {type:'bar',
    data:{labels:days, datasets:[{label:'Денні витрати',data:[9.6,11.2,8.4,14.4,10.4,16,12,12].map(v=>v*1000),backgroundColor:'rgba(28,26,22,.65)',borderRadius:4}]},
    options:{responsive:true,plugins:{legend:{labels:{color:tc,font:{family:'DM Sans',size:11}}}},scales:{x:{ticks:{color:tc,font:{size:10}},grid:{display:false}},y:{ticks:{color:tc,font:{size:10},callback:v=>'₴'+Math.round(v/1000)+'K'},grid:{color:gc}}}}});

  const rv = document.getElementById('revChart');
  if(rv) new Chart(rv.getContext('2d'), {type:'bar',
    data:{labels:months, datasets:[{label:'Місячний дохід',data:[540,620,580,710,660,780,820,760,890,1160,884,996].map(v=>v*1000),backgroundColor:months.map((_,i)=>i===11?'#1C1A16':'rgba(28,26,22,.2)'),borderRadius:4}]},
    options:{responsive:true,plugins:{legend:{labels:{color:tc,font:{family:'DM Sans',size:11}}}},scales:{x:{ticks:{color:tc,font:{size:10}},grid:{display:false}},y:{ticks:{color:tc,font:{size:10},callback:v=>'₴'+Math.round(v/1000)+'K'},grid:{color:gc}}}}});
}, 100); } catch(e) { console.log('Chart error:', e); }

// NAV
const T = {overview:'Дашборд',cashflow:'Кеш Флоу',efficiency:'Ефективність',transactions:'Транзакції',expenses:'Витрати',revenue:'Доходи',budgets:'Бюджети',audit:'AI Аудит',assistant:'AI Асистент',forecast:'Прогнозування',fraud:'Виявлення шахрайства',benchmark:'Бенчмарк',agents:'AI Агенти',score:'AI Score',notifications:'Сповіщення',whatif:'What If Сценарії',investor:'Investor Mode',reports:'Звіти'};
const S = {overview:'Травень 2026 · Монобанк Бізнес',cashflow:'Рух коштів · Травень 2026',efficiency:'Показники ефективності',transactions:'847 транзакцій завантажено',expenses:'Аналіз витрат · Травень 2026',revenue:'Аналіз доходів · Травень 2026',budgets:'Бюджет vs Факт · Травень 2026',audit:'Останній запуск 2 год тому',assistant:'Запитай AI фінансового директора',forecast:'Прогнози cashflow та runway',fraud:'Виявлення аномалій і шахрайства',benchmark:'Порівняння з ринком',agents:'Автономні AI агенти',score:'Фінансове здоровʼя компанії',notifications:'Розумні сповіщення в реальному часі',whatif:'Моделювання фінансових сценаріїв',investor:'Звіти та аналітика для інвесторів',reports:'Всі звіти'};

function nav(p, el) {
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('on'));
  document.querySelectorAll('.sb-item').forEach(x=>x.classList.remove('on'));
  document.getElementById('pg-'+p).classList.add('on');
  if(el) el.classList.add('on');
  const _tt = document.getElementById('tbTitle'); if(_tt) _tt.textContent = T[p]||p;
  const _ts = document.getElementById('tbSub'); if(_ts) _ts.textContent = S[p]||'';
  closeSb();
}
function openSb(){document.getElementById('sidebar').classList.add('open');document.getElementById('overlay').classList.add('open');}
function closeSb(){document.getElementById('sidebar').classList.remove('open');document.getElementById('overlay').classList.remove('open');}
function setPer(el){document.querySelectorAll('.ptab').forEach(b=>b.classList.remove('on'));el.classList.add('on');}
function flash(btn,msg){const o=btn.textContent;btn.textContent=msg;setTimeout(()=>btn.textContent=o,2000);}

// AUDIT
function loadEx(){document.getElementById('auditTx').value=`01.05 Figma Pro x8 -₴4,480\n02.05 Zoom Business -₴3,560\n03.05 AWS Cloud -₴16,800\n05.05 Оплата Acme +₴128,000\n07.05 Tableau -₴5,840\n08.05 Slack Business+ -₴7,500\n10.05 Microsoft Teams -₴3,680\n12.05 Adobe CC 15 -₴12,800`;}

function animLoad(){
  const ids=['l1','l2','l3','l4','l5']; let i=0;
  return new Promise(res=>{
    const iv=setInterval(()=>{
      if(i>0){const p=document.getElementById(ids[i-1]);p.classList.remove('on');p.classList.add('ok');p.querySelector('.ls-dot').style.background='var(--green)';}
      if(i<ids.length) document.getElementById(ids[i]).classList.add('on');
      i++; if(i>ids.length){clearInterval(iv);res();}
    },560);
  });
}

async function runAudit(){
  const tx=document.getElementById('auditTx').value.trim();
  if(!tx){alert('Вставте транзакції');return;}
  const biz=document.getElementById('aBiz').value;
  const team=document.getElementById('aTeam').value;
  document.querySelector('.audit-form').style.display='none';
  document.getElementById('aLdg').classList.add('on');
  document.getElementById('aRes').classList.remove('on');
  const lp=animLoad();
  const prompt=`Ти — AI-агент SpenScan для аудиту бізнес-витрат в Україні.\nБізнес: ${biz}, команда: ${team}\nТранзакції:\n${tx}\nВідповідай ТІЛЬКИ JSON без markdown:\n{"totalSavings":число,"issueCount":число,"summary":"2-3 речення","issues":[{"type":"crit|warn|info","title":"назва","description":"опис","savingsPerMonth":число}]}\nСуми в гривнях. Відповідай українською.`;
  try{
    await lp;
    const rawText = await callClaude('', [{role:'user',content:prompt}], 1500);
    let res; try{res=JSON.parse(rawText.replace(/```json|```/g,'').trim());}catch(e){res=fb();}
    showRes(res);
  }catch(e){await lp;showRes(fb());}
}

function fb(){return{totalSavings:14280,issueCount:4,summary:'Виявлено дублікати комунікаційних інструментів та неефективне використання ліцензій. Загальна потенційна економія ₴14,280 на місяць.',issues:[{type:'crit',title:'Дублювання — Zoom + Teams',description:'Обидва інструменти для відеодзвінків. Залиш той яким користується команда.',savingsPerMonth:3560},{type:'crit',title:'Figma — 3 зайві місця',description:'8 місць оплачено, 5 активних. Знизь план.',savingsPerMonth:4480},{type:'warn',title:'Tableau — 47 днів без входу',description:'Ніхто не заходив. Розглянь скасування або безкоштовну альтернативу.',savingsPerMonth:5840},{type:'info',title:'Оптимізація планів підписок',description:'Деякі підписки розраховані на більшу команду.',savingsPerMonth:400}]};}

function showRes(r){
  document.getElementById('aLdg').classList.remove('on');
  document.getElementById('aSaveNum').textContent='₴'+(r.totalSavings||0).toLocaleString('uk-UA');
  document.getElementById('aSumText').textContent=r.summary||'';
  const list=document.getElementById('aIssues'); list.innerHTML='';
  (r.issues||[]).forEach(iss=>{
    const el=document.createElement('div'); el.className='ai-row '+(iss.type||'info');
    el.innerHTML=`<div><div class="ai-t">${iss.title}</div><div class="ai-d">${iss.description}</div></div>${iss.savingsPerMonth>0?`<div class="ai-s">-₴${iss.savingsPerMonth.toLocaleString('uk-UA')}/міс</div>`:''}`;
    list.appendChild(el);
  });
  document.getElementById('aRes').classList.add('on');
}
function copyAudit(){const n=document.getElementById('aSaveNum').textContent;const s=document.getElementById('aSumText').textContent;navigator.clipboard.writeText(`ЗВІТ SPENSCAN\nЕкономія: ${n}/міс\n\n${s}\n\nspenscan.ua`).then(()=>alert('Скопійовано'));}


// ── FORECAST CHART ──
setTimeout(() => {
  const fc = document.getElementById('forecastChart');
  if(fc) new Chart(fc.getContext('2d'), {
    type:'line',
    data:{
      labels:['Трав','Черв','Лип','Серп','Вер','Жов'],
      datasets:[
        {label:'Прогноз доходу',data:[996,1100,1180,1240,1310,1400].map(v=>v*1000),borderColor:'#2A6E46',backgroundColor:'rgba(42,110,70,.06)',fill:true,tension:.4,pointRadius:3,borderDash:[],pointBackgroundColor:'#2A6E46'},
        {label:'Прогноз витрат',data:[334,340,355,368,380,395].map(v=>v*1000),borderColor:'#B83228',backgroundColor:'rgba(184,50,40,.04)',fill:true,tension:.4,pointRadius:3,borderDash:[4,4]},
        {label:'Оптимістичний',data:[996,1150,1250,1340,1450,1580].map(v=>v*1000),borderColor:'rgba(42,110,70,.3)',tension:.4,pointRadius:0,borderDash:[2,4],fill:false}
      ]
    },
    options:{responsive:true,plugins:{legend:{labels:{color:'#7A7264',font:{family:'DM Sans',size:11}}}},scales:{x:{ticks:{color:'#7A7264',font:{size:10}},grid:{color:'rgba(44,40,32,.05)'}},y:{ticks:{color:'#7A7264',font:{size:10},callback:v=>'₴'+Math.round(v/1000)+'K'},grid:{color:'rgba(44,40,32,.05)'}}}}
  });

  // BENCHMARK CHART
  const bc = document.getElementById('benchChart');
  if(bc) new Chart(bc.getContext('2d'), {
    type:'bar',
    data:{
      labels:['SaaS','Маркетинг','Зарплати','Офіс','Інфра'],
      datasets:[
        {label:'Ваша компанія',data:[93600,48000,140000,24800,33600],backgroundColor:'rgba(44,40,32,.75)',borderRadius:4},
        {label:'Середнє по ринку',data:[68000,54000,138000,22000,28000],backgroundColor:'rgba(196,180,140,.5)',borderRadius:4}
      ]
    },
    options:{responsive:true,plugins:{legend:{labels:{color:'#7A7264',font:{family:'DM Sans',size:11}}}},scales:{x:{ticks:{color:'#7A7264',font:{size:10}},grid:{display:false}},y:{ticks:{color:'#7A7264',font:{size:10},callback:v=>'₴'+Math.round(v/1000)+'K'},grid:{color:'rgba(44,40,32,.05)'}}}}
  });
}, 200);


// ── API KEY ──
let CLAUDE_API_KEY = '';

function saveApiKey() {
  const key = document.getElementById('apiKeyInput').value.trim();
  if (!key.startsWith('sk-ant-')) {
    const _as1 = document.getElementById('apiStatus');
    if(_as1) { _as1.textContent = 'Невiрний ключ'; _as1.style.color = 'var(--red)'; }
    return;
  }
  CLAUDE_API_KEY = key;
  const _as2 = document.getElementById('apiStatus');
  if(_as2) { _as2.textContent = 'Ключ збережено — AI готовий'; _as2.style.color = '#6EE7A0'; }
  document.getElementById('apiKeyInput').value = '••••••••••••••••';
}

async function callClaude(system, messages, maxTokens = 800) {
  if (!CLAUDE_API_KEY) {
    return 'Введіть API ключ у верхньому рядку щоб активувати AI';
  }
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: system,
      messages: messages
    })
  });
  const data = await resp.json();
  if (data.error) throw new Error(data.error.message);
  return data.content.map(b => b.text || '').join('');
}

// ── AI ASSISTANT ──
const chatHistory = [];

function quickQ(btn) {
  document.getElementById('chatInput').value = btn.textContent;
  sendChat();
}
function quickQText(text) {
  document.getElementById('chatInput').value = text;
  sendChat();
}

function addMsg(text, role) {
  const msgs = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg ' + role;
  div.textContent = text;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if(!text) return;
  input.value = '';

  addMsg(text, 'user');
  chatHistory.push({role:'user', content:text});

  const typing = addMsg('AI аналізує...', 'typing');

  const systemPrompt = `Ти — AI фінансовий директор компанії SpenScan. Відповідай як досвідчений CFO. 
Дані компанії:
- Дохід (30д): ₴996K, зростання +12.4%
- Витрати (30д): ₴334K, зростання +18.2% (витрати ростуть швидше!)
- Баланс: ₴2.45M
- Burn rate: ₴11K/день
- Runway: 7.3 місяці
- SaaS витрати: ₴93,600/міс (вище ринку на 35%)
- Проблеми: Zoom дублює Teams (-₴3,560), Figma 3 зайві місця (-₴4,480), Tableau не використовується (-₴5,840)
- Потенційна економія: ₴14,280/міс
Відповідай коротко (3-5 речень), конкретно, з цифрами. Українською мовою.`;

  try {
    const reply = await callClaude(systemPrompt, chatHistory, 600);
    typing.remove();
    addMsg(reply, 'ai');
    chatHistory.push({role:'assistant', content:reply});
  } catch(e) {
    typing.remove();
    addMsg('Помилка: ' + (e.message || 'перевірте API ключ'), 'ai');
  }
}



// ══ BANK CONNECTION ══
const BANKS = {
  DE: [
    {id:'DEUTSCHE_BANK',name:'Deutsche Bank',color:'#003A82',abbr:'DB'},
    {id:'N26',name:'N26',color:'#26B5A0',abbr:'N26'},
    {id:'ING_DE',name:'ING Deutschland',color:'#FF6200',abbr:'ING'},
    {id:'COMMERZBANK',name:'Commerzbank',color:'#FFCC00',abbr:'CB'},
    {id:'SPARKASSE',name:'Sparkasse',color:'#FF0000',abbr:'SP'},
    {id:'DKB',name:'DKB Bank',color:'#1E3A5F',abbr:'DKB'},
  ],
  PL: [
    {id:'PKO',name:'PKO Bank Polski',color:'#003087',abbr:'PKO'},
    {id:'MBANK',name:'mBank',color:'#E2001A',abbr:'mB'},
    {id:'ING_PL',name:'ING Bank Śląski',color:'#FF6200',abbr:'ING'},
    {id:'SANTANDER_PL',name:'Santander Bank Polska',color:'#EC0000',abbr:'SAN'},
    {id:'MILLENNIUM',name:'Bank Millennium',color:'#E60028',abbr:'MIL'},
    {id:'ALIOR',name:'Alior Bank',color:'#E30613',abbr:'ALI'},
  ],
  GB: [
    {id:'BARCLAYS',name:'Barclays',color:'#00AEEF',abbr:'BAR'},
    {id:'HSBC',name:'HSBC',color:'#DB0011',abbr:'HSBC'},
    {id:'MONZO',name:'Monzo',color:'#FF3464',abbr:'MNZ'},
    {id:'STARLING',name:'Starling Bank',color:'#6935D3',abbr:'STL'},
    {id:'LLOYDS',name:'Lloyds Bank',color:'#006A4D',abbr:'LLY'},
    {id:'NATWEST',name:'NatWest',color:'#42145F',abbr:'NW'},
  ],
  IE: [
    {id:'AIB',name:'AIB Bank',color:'#004F9F',abbr:'AIB'},
    {id:'BOI',name:'Bank of Ireland',color:'#004D40',abbr:'BOI'},
    {id:'ULSTER',name:'Ulster Bank',color:'#5C2D91',abbr:'ULB'},
    {id:'PTSB',name:'Permanent TSB',color:'#E31837',abbr:'TSB'},
    {id:'KBC_IE',name:'KBC Ireland',color:'#00A2E2',abbr:'KBC'},
  ],
  CZ: [
    {id:'CESKA',name:'Česká spořitelna',color:'#E2001A',abbr:'CS'},
    {id:'CSOB',name:'ČSOB',color:'#004B87',abbr:'ČSOB'},
    {id:'KOMERCNI',name:'Komerční banka',color:'#E2001A',abbr:'KB'},
    {id:'MONETA',name:'Moneta Money Bank',color:'#E2001A',abbr:'MNT'},
  ],
  NL: [
    {id:'ING_NL',name:'ING Bank',color:'#FF6200',abbr:'ING'},
    {id:'ABN',name:'ABN AMRO',color:'#009900',abbr:'ABN'},
    {id:'RABO',name:'Rabobank',color:'#E2001A',abbr:'RAB'},
    {id:'SNS',name:'SNS Bank',color:'#E2001A',abbr:'SNS'},
  ],
  EU: [
    {id:'REVOLUT',name:'Revolut Business',color:'#191C1F',abbr:'REV'},
    {id:'WISE',name:'Wise Business',color:'#00B9FF',abbr:'WISE'},
    {id:'BUNQ',name:'Bunq',color:'#00C4B4',abbr:'BNQ'},
    {id:'PAYSERA',name:'Paysera',color:'#0072C6',abbr:'PAY'},
  ],
  OTHER: [
    {id:'REVOLUT',name:'Revolut Business',color:'#191C1F',abbr:'REV'},
    {id:'WISE',name:'Wise Business',color:'#00B9FF',abbr:'WISE'},
    {id:'UNICREDIT',name:'UniCredit',color:'#E2001A',abbr:'UNI'},
    {id:'RAIFFEISEN',name:'Raiffeisen Bank',color:'#FFD700',abbr:'RAI'},
    {id:'ERSTE',name:'Erste Bank',color:'#E2001A',abbr:'EB'},
  ]
};

let selectedCountry = 'DE';
let selectedBank = null;

function openBankModal() {
  const _bm = document.getElementById('bankModal'); if(_bm) _bm.style.display = 'flex';
  renderBankList();
}

function closeBankModal() {
  const _bm2 = document.getElementById('bankModal'); if(_bm2) _bm2.style.display = 'none';
  goStep(1);
  selectedBank = null;
  const _sn2 = document.getElementById('step2Next');
  if(_sn2) { _sn2.disabled = true; _sn2.style.opacity = '.4'; }
}

function selectCountry(el, code) {
  document.querySelectorAll('.bank-country-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  selectedCountry = code;
  renderBankList();
}

function renderBankList() {
  const banks = BANKS[selectedCountry] || [];
  const q = (document.getElementById('bankSearch')?.value || '').toLowerCase();
  const filtered = banks.filter(b => b.name.toLowerCase().includes(q));
  const list = document.getElementById('bankList');
  if (!list) return;
  list.innerHTML = filtered.map(b => `
    <div class="bank-item" onclick="selectBank(this,'${b.id}','${b.name}')" data-id="${b.id}">
      <div class="bank-logo" style="background:${b.color}20;color:${b.color};border:1px solid ${b.color}30;">${b.abbr}</div>
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--ink);">${b.name}</div>
        <div style="font-size:10.5px;color:var(--warm);">Open Banking · PSD2</div>
      </div>
      <div style="margin-left:auto;font-size:11px;color:var(--warm);" id="sel_${b.id}"></div>
    </div>
  `).join('');
}

function filterBanks() { renderBankList(); }

function selectBank(el, id, name) {
  document.querySelectorAll('.bank-item').forEach(i => {
    i.classList.remove('selected');
    const sel = i.querySelector('[id^="sel_"]');
    if(sel) sel.textContent = '';
  });
  el.classList.add('selected');
  const sel = el.querySelector('[id^="sel_"]');
  if(sel) sel.textContent = '✓';
  selectedBank = {id, name};
  const _sn = document.getElementById('step2Next');
  if(_sn) { _sn.disabled = false; _sn.style.opacity = '1'; }
  const _bn2 = document.getElementById('selectedBankName');
  if(_bn2) _bn2.textContent = name;
}

function goStep(n) {
  const s1 = document.getElementById('bankStep1');
  const s2 = document.getElementById('bankStep2');
  const s3 = document.getElementById('bankStep3');
  if(s1) s1.style.display = n===1 ? 'block' : 'none';
  if(s2) s2.style.display = n===2 ? 'block' : 'none';
  if(s3) s3.style.display = n===3 ? 'block' : 'none';

  ['bstep1','bstep2','bstep3'].forEach((id,i) => {
    const el = document.getElementById(id);
    if(el) el.className = 'bank-step-dot' + (i+1 < n ? ' done' : i+1 === n ? ' active' : '');
  });
  ['bline1','bline2'].forEach((id,i) => {
    const el = document.getElementById(id);
    if(el) el.className = 'bank-step-line' + (i+1 < n ? ' done' : '');
  });

  if(n===3) {
    const cs = document.getElementById('connectingState');
    const ls = document.getElementById('loadingState');
    const ss = document.getElementById('successState');
    const sb = document.getElementById('step3Btns');
    if(cs) cs.style.display = 'block';
    if(ls) ls.style.display = 'none';
    if(ss) ss.style.display = 'none';
    if(sb) sb.style.display = 'grid';
  }
}

async function connectBank() {
  if(!selectedBank) return;

  // Show loading
  const _cs = document.getElementById('connectingState');
  const _sb = document.getElementById('step3Btns');
  const _ls = document.getElementById('loadingState');
  if(_cs) _cs.style.display = 'none';
  if(_sb) _sb.style.display = 'none';
  if(_ls) _ls.style.display = 'block';

  const steps = [
    'Встановлення захищеного зєднання...',
    'Авторизація через Open Banking...',
    'Отримання списку рахункiв...',
    'Завантаження транзакцій...',
    'Аналіз даних...'
  ];

  for(const step of steps) {
    const _lt = document.getElementById('loadingText'); if(_lt) _lt.textContent = step;
    await new Promise(r => setTimeout(r, 700));
  }

  // Show success
  const _ls2 = document.getElementById('loadingState');
  const _ss2 = document.getElementById('successState');
  if(_ls2) _ls2.style.display = 'none';
  if(_ss2) _ss2.style.display = 'block';

  // Animate counters
  const txTarget = Math.floor(Math.random() * 400) + 500;
  const accTarget = Math.floor(Math.random() * 3) + 1;
  animCounter('txCount', txTarget, 1200);
  animCounter('accCount', accTarget, 600);
  animCounter('daysCount', 90, 900);

  const _sm = document.getElementById('successMsg'); if(_sm) _sm.textContent = selectedBank.name + ' успішно пiдключено!';

  // Update sidebar
  const _bn = document.getElementById('sbBankName'); if(_bn) _bn.textContent = selectedBank.name;
  const _bsync = document.getElementById('sbBankSync'); if(_bsync) _bsync.textContent = 'Щойно синхронiзовано';
  const _ld = document.querySelector('.sb-live-dot'); if(_ld) _ld.style.background = '#6EE7A0';

  // Close after 2.5s
  setTimeout(() => {
    closeBankModal();
    // Show notification
    showBankNotification(selectedBank.name, txTarget);
  }, 2500);
}

function animCounter(id, target, duration) {
  const el = document.getElementById(id);
  const start = 0;
  const step = target / (duration / 16);
  let current = start;
  const timer = setInterval(() => {
    current += step;
    if(current >= target) { current = target; clearInterval(timer); }
    el.textContent = Math.round(current);
  }, 16);
}

function showBankNotification(bankName, txCount) {
  const notif = document.createElement('div');
  notif.style.cssText = 'position:fixed;bottom:80px;right:24px;background:var(--ink);color:var(--cream);padding:14px 18px;border-radius:12px;font-size:13px;font-weight:600;z-index:999;box-shadow:0 8px 24px rgba(0,0,0,.2);max-width:280px;';
  notif.innerHTML = '<div style="font-size:11px;color:rgba(255,255,255,.4);margin-bottom:3px;">БАНК ПІДКЛЮЧЕНО</div>' + bankName + ' — завантажено ' + txCount + ' транзакцій';
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 4000);
}

// ── WHAT IF ──
function updateWhatIf() {
  const expEl = document.getElementById('expChange');
  const revEl = document.getElementById('revChange');
  const hireEl = document.getElementById('hireChange');
  if(!expEl || !revEl || !hireEl) return;
  const exp = parseInt(expEl.value);
  const rev = parseInt(revEl.value);
  const hire = parseInt(hireEl.value);
  const evEl = document.getElementById('expVal');
  const rvEl = document.getElementById('revVal');
  const hvEl = document.getElementById('hireVal');
  if(evEl) evEl.textContent = (exp >= 0 ? '+' : '') + exp + '%';
  if(rvEl) rvEl.textContent = (rev >= 0 ? '+' : '') + rev + '%';
  if(hvEl) hvEl.textContent = hire + ' осіб';

  const baseДоходи = 996000;
  const baseВитрати = 334000;
  const baseBalance = 2450000;
  const salaryPerPerson = 50000;

  const newRev = baseДоходи * (1 + rev/100);
  const newExp = baseВитрати * (1 + exp/100) + hire * salaryPerPerson;
  const newProfit = newRev - newExp;
  const newBurn = newExp / 30;
  const newRunway = baseBalance > 0 ? (baseBalance / newBurn) : 0;
  const newScore = Math.max(30, Math.min(100, 73 - exp/3 + rev/4 - hire*1.5));

  const _wr = document.getElementById('wi-runway');
  const _wp = document.getElementById('wi-profit');
  const _wb = document.getElementById('wi-burn');
  const _ws = document.getElementById('wi-score');
  if(_wr) { _wr.textContent = newRunway.toFixed(1) + ' міс'; _wr.style.color = newRunway > 10 ? 'var(--green)' : newRunway > 6 ? 'var(--amber)' : 'var(--red)'; }
  if(_wp) { _wp.textContent = '₴' + Math.round(newProfit/1000) + 'K'; _wp.style.color = newProfit > 0 ? 'var(--green)' : 'var(--red)'; }
  if(_wb) _wb.textContent = '₴' + Math.round(newBurn/1000) + 'K/д';
  if(_ws) { _ws.textContent = Math.round(newScore); _ws.style.color = newScore > 75 ? 'var(--green)' : newScore > 55 ? 'var(--amber)' : 'var(--red)'; }

  const verdict = document.getElementById('wi-verdict');
  if (newRunway < 4) {
    verdict.style.background = 'var(--red-bg)'; verdict.style.borderColor = '#F0C4C0'; verdict.style.color = 'var(--red)';
    verdict.textContent = 'Критичний сценарій: runway менше 4 місяців. Термінова оптимізація витрат або залучення інвестицій.';
  } else if (newRunway < 7) {
    verdict.style.background = 'var(--amber-bg)'; verdict.style.borderColor = '#F0DDB8'; verdict.style.color = 'var(--amber)';
    verdict.textContent = 'Ризикований сценарій: runway нижче 7 місяців. Рекомендуємо скоротити витрати або прискорити залучення доходу.';
  } else if (newProfit > 800000) {
    verdict.style.background = 'var(--green-bg)'; verdict.style.borderColor = '#B8DFC5'; verdict.style.color = 'var(--green)';
    verdict.textContent = 'Відмінний сценарій! Runway ' + newRunway.toFixed(1) + ' місяців, прибуток зростає. Можна розглянути найм або нові інвестиції.';
  } else {
    verdict.style.background = 'var(--amber-bg)'; verdict.style.borderColor = '#F0DDB8'; verdict.style.color = 'var(--amber)';
    verdict.textContent = 'Стабільний сценарій. Runway ' + newRunway.toFixed(1) + ' місяців. Слідкуйте за балансом витрат і доходу.';
  }
}

function setScenario(exp, rev, hire) {
  document.getElementById('expChange').value = exp;
  document.getElementById('revChange').value = rev;
  document.getElementById('hireChange').value = hire;
  updateWhatIf();
}

function resetAudit(){document.getElementById('aRes').classList.remove('on');document.getElementById('aLdg').classList.remove('on');document.querySelector('.audit-form').style.display='block';document.querySelectorAll('.ls').forEach(s=>{s.className='ls';s.querySelector('.ls-dot').style.background='';});}