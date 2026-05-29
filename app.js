'use strict';

// ══ CONFIG ══
const CFG = {
  BASE_REVENUE:    996000,
  BASE_EXPENSES:   334000,
  BASE_BALANCE:   2450000,
  SALARY_PER_PERSON: 50000,
  CHAT_HISTORY_LIMIT: 20,
  CHART_INIT_DELAY:  120,
  CLAUDE_MODEL: 'claude-sonnet-4-20250514',
};

// ══ STATE ══
const state = {
  apiKey: '',
  chatHistory: [],
  selectedCountry: 'DE',
  selectedBank: null,
  charts: {},
  connectTimer: null,
};

// ══ UTILS ══
const $ = id => document.getElementById(id);
const setText = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };

function esc(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function showToast(msg, type = 'info') {
  document.querySelector('.ss-toast')?.remove();
  const colors = { info:'var(--ink)', success:'var(--green)', error:'var(--red)' };
  const el = document.createElement('div');
  el.className = 'ss-toast';
  el.style.cssText = `position:fixed;bottom:80px;right:24px;background:${colors[type]||colors.info};color:var(--cream);padding:12px 18px;border-radius:10px;font-size:13px;font-weight:600;z-index:1000;box-shadow:0 8px 24px rgba(0,0,0,.2);max-width:300px;animation:slideIn .2s ease;pointer-events:none;`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ══ CHART REGISTRY ══
function mkChart(id, config) {
  // Destroy existing instance to prevent memory leak
  if (state.charts[id]) {
    state.charts[id].destroy();
    delete state.charts[id];
  }
  const el = $(id);
  if (!el) return null;
  const chart = new Chart(el, config);
  state.charts[id] = chart;
  return chart;
}

const TC = '#7A7264';
const GC = 'rgba(28,26,22,.05)';
const FONT = 'DM Sans';

function lineDataset(label, data, color, opts = {}) {
  return { label, data, borderColor: color, backgroundColor: color.replace(')', ',.06)').replace('rgb','rgba'), fill: opts.fill ?? false, tension: .4, pointRadius: 3, pointBackgroundColor: color, borderDash: opts.dash, ...opts };
}

function mkLine(id, labels, datasets) {
  return mkChart(id, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { labels: { color: TC, font: { family: FONT, size: 11 } } } },
      scales: {
        x: { ticks: { color: TC, font: { size: 10 } }, grid: { color: GC } },
        y: { ticks: { color: TC, font: { size: 10 }, callback: v => '₴' + Math.round(v/1000) + 'K' }, grid: { color: GC } }
      }
    }
  });
}

// ══ DATA ══
const TX = [
  { abbr:'AW', name:'AWS Cloud Services',   cat:'Інфраструктура', date:'3 тра',  amount:-16800,  st:'ok',   ai:'' },
  { abbr:'FG', name:'Figma Pro x8',          cat:'Дизайн',         date:'2 тра',  amount:-4480,   st:'warn', ai:'3 зайві місця' },
  { abbr:'AC', name:'Acme Corp — оплата',    cat:'Дохід',          date:'30 кві', amount:128000,  st:'ok',   ai:'' },
  { abbr:'ZM', name:'Zoom Business',         cat:'Комунікація',    date:'1 тра',  amount:-3560,   st:'crit', ai:'Дублює Teams' },
  { abbr:'TB', name:'Tableau ліцензія',      cat:'Аналітика',      date:'29 кві', amount:-5840,   st:'warn', ai:'47 днів без входу' },
  { abbr:'SL', name:'Slack Business+',       cat:'Комунікація',    date:'28 кві', amount:-7500,   st:'warn', ai:'Ціна +22%' },
  { abbr:'GW', name:'Google Workspace',      cat:'Продуктивність', date:'27 кві', amount:-5760,   st:'ok',   ai:'' },
  { abbr:'BS', name:'Beta Solutions',        cat:'Дохід',          date:'26 кві', amount:216000,  st:'ok',   ai:'' },
  { abbr:'GH', name:'GitHub Enterprise',     cat:'Розробка',       date:'25 кві', amount:-8400,   st:'ok',   ai:'' },
  { abbr:'GA', name:'Google Ads',            cat:'Маркетинг',      date:'24 кві', amount:-16000,  st:'ok',   ai:'' },
];

function chipClass(st) { return st === 'ok' ? 'c-g' : st === 'crit' ? 'c-r' : 'c-a'; }
function chipText(st)  { return st === 'ok' ? 'Норма' : st === 'crit' ? 'Критично' : 'Увага'; }

function renderTxRow(t, idx, full = false) {
  const sign = t.amount < 0 ? '-' : '+';
  const cls  = t.amount < 0 ? 'neg' : 'pos';
  const amt  = Math.abs(t.amount).toLocaleString('uk-UA');
  const nameCell = `<div style="display:flex;align-items:center;">
    <span class="ico">${esc(t.abbr)}</span>
    <div><div class="td-name">${esc(t.name)}</div><div class="td-cat">${esc(t.cat)}</div></div>
  </div>`;

  if (!full) return `<tr>
    <td>${nameCell}</td>
    <td style="color:var(--warm);font-size:11.5px;font-family:'DM Mono',monospace;">${esc(t.date)}</td>
    <td class="${cls}">${sign} ₴${amt}</td>
    <td><span class="chip ${chipClass(t.st)}">${chipText(t.st)}</span></td>
  </tr>`;

  return `<tr>
    <td style="color:var(--warm);font-family:'DM Mono',monospace;font-size:11px;">${String(idx+1).padStart(3,'0')}</td>
    <td>${nameCell}</td>
    <td><span class="chip c-n">${esc(t.cat)}</span></td>
    <td style="color:var(--warm);font-size:11.5px;font-family:'DM Mono',monospace;">${esc(t.date)} 2026</td>
    <td class="${cls}">${sign} ₴${amt}</td>
    <td><span class="chip ${chipClass(t.st)}">${chipText(t.st)}</span></td>
    <td style="font-size:11px;color:${t.ai?'var(--red)':'var(--warm)'};font-family:'DM Mono',monospace;">${esc(t.ai)||'—'}</td>
  </tr>`;
}

function initTables() {
  const ovTx = $('ovTx');
  if (ovTx) ovTx.innerHTML = TX.slice(0,5).map((t,i) => renderTxRow(t,i,false)).join('');
  const allTx = $('allTx');
  if (allTx) allTx.innerHTML = TX.map((t,i) => renderTxRow(t,i,true)).join('');
}

function initAIRecs() {
  const el = $('ovAI');
  if (!el) return;
  const recs = [
    { type:'crit', title:'Zoom + Teams — дублювання',       desc:'Два інструменти для одних цілей. Скасуй Zoom.',              saving:'3,560' },
    { type:'crit', title:'Figma — 3 зайві місця',           desc:'8 місць, 5 активних. Знизь план.',                          saving:'4,480' },
    { type:'warn', title:'Tableau — 47 днів без активності',desc:'Розглянь скасування або безкоштовну альтернативу.',          saving:'5,840' },
  ];
  el.innerHTML = recs.map(r => `
    <div class="ai-row ${esc(r.type)}">
      <div><div class="ai-t">${esc(r.title)}</div><div class="ai-d">${esc(r.desc)}</div></div>
      <div class="ai-s">-₴${r.saving}/міс</div>
    </div>`).join('');
}

// ══ NAV ══
const PAGE_TITLES = {
  overview:'Дашборд', cashflow:'Кеш Флоу', efficiency:'Ефективність',
  transactions:'Транзакції', expenses:'Витрати', revenue:'Доходи',
  budgets:'Бюджети', audit:'AI Аудит', assistant:'AI Асистент',
  forecast:'Прогнозування', fraud:'Виявлення шахрайства', benchmark:'Бенчмарк',
  agents:'AI Агенти', score:'AI Score', notifications:'Сповіщення',
  whatif:'What If Сценарії', investor:'Investor Mode', reports:'Звіти',
};
const PAGE_SUBS = {
  overview:'Травень 2026 · Монобанк Бізнес', cashflow:'Рух коштів · Травень 2026',
  efficiency:'Показники ефективності', transactions:'847 транзакцій завантажено',
  expenses:'Аналіз витрат · Травень 2026', revenue:'Аналіз доходів · Травень 2026',
  budgets:'Бюджет vs Факт · Травень 2026', audit:'Останній запуск 2 год тому',
  assistant:'Запитай AI фінансового директора', forecast:'Прогнози cashflow та runway',
  fraud:'Виявлення аномалій і шахрайства', benchmark:'Порівняння з ринком',
  agents:'Автономні AI агенти', score:'Фінансове здоровʼя компанії',
  notifications:'Розумні сповіщення в реальному часі',
  whatif:'Моделювання фінансових сценаріїв',
  investor:'Звіти та аналітика для інвесторів', reports:'Всі звіти',
};

// nav() stays global so existing inline onclick attrs keep working
function nav(page, legacyEl) {
  document.querySelectorAll('.page').forEach(x => x.classList.remove('on'));
  document.querySelectorAll('.sb-item').forEach(x => x.classList.remove('on'));
  const pg = $('pg-' + page);
  if (pg) pg.classList.add('on');
  // Auto-find sidebar item by data-page (new) or use legacy el
  const sbItem = document.querySelector(`.sb-item[data-page="${page}"]`) || legacyEl;
  if (sbItem) sbItem.classList.add('on');
  setText('tbTitle', PAGE_TITLES[page] || page);
  setText('tbSub',   PAGE_SUBS[page] || '');
  closeSb();
}

function openSb()  { $('sidebar')?.classList.add('open');    $('overlay')?.classList.add('open'); }
function closeSb() { $('sidebar')?.classList.remove('open'); $('overlay')?.classList.remove('open'); }
function setPer(el) { document.querySelectorAll('.ptab').forEach(b => b.classList.remove('on')); el.classList.add('on'); }

function flash(btn, msg) {
  const orig = btn.textContent;
  btn.textContent = msg;
  btn.disabled = true;
  setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2000);
}

// ══ CHARTS ══
const DAYS   = ['4 кві','8 кві','12 кві','16 кві','20 кві','24 кві','28 кві','2 тра'];
const MONTHS = ['чер','лип','сер','вер','жов','лис','гру','січ','лют','бер','кві','тра'];

function initCharts() {
  try {
    mkLine('mainChart', DAYS, [
      { label:'Дохід',   data:[128,164,112,208,156,244,192,228].map(v=>v*1000), borderColor:'#2A6E46', backgroundColor:'rgba(42,110,70,.06)',  fill:true, tension:.4, pointRadius:3, pointBackgroundColor:'#2A6E46' },
      { label:'Витрати', data:[72,84,64,96,76,112,88,104].map(v=>v*1000),      borderColor:'#B83228', backgroundColor:'rgba(184,50,40,.04)', fill:true, tension:.4, pointRadius:3, pointBackgroundColor:'#B83228' },
    ]);

    mkChart('donutChart', {
      type:'doughnut',
      data:{ labels:['SaaS','Зарплати','Маркетинг','Офіс','Тревел','Інше'],
        datasets:[{ data:[28,42,15,8,4,3], backgroundColor:['#1C1A16','#7A7264','#B8A888','#2A6E46','#B83228','#8C5808'], borderWidth:0, hoverOffset:5 }] },
      options:{ responsive:true, cutout:'63%', plugins:{ legend:{ position:'bottom', labels:{ color:TC, font:{ family:FONT, size:11 }, padding:10 } } } }
    });

    mkLine('cfChart', MONTHS, [
      { label:'Надходження', data:[540,620,580,710,660,780,820,760,890,1160,884,996].map(v=>v*1000),  borderColor:'#2A6E46', backgroundColor:'rgba(42,110,70,.05)',  fill:true, tension:.4, pointRadius:3 },
      { label:'Вихідні',     data:[240,268,244,292,272,316,328,304,348,452,340,334].map(v=>v*1000),   borderColor:'#B83228', backgroundColor:'rgba(184,50,40,.04)', fill:true, tension:.4, pointRadius:3 },
    ]);

    mkChart('watChart', {
      type:'bar',
      data:{ labels:['Поч.','+Надх.','-Зарп.','-SaaS','-Мрк.','-Ін.','Кін.'],
        datasets:[{ data:[1800,996,-140,-93.6,-48,-52,2462].map(v=>v*1000),
          backgroundColor:['#C8BEA8','#2A6E46','#B83228','#B83228','#B83228','#B83228','#1C1A16'], borderRadius:4 }] },
      options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{
        x:{ ticks:{ color:TC, font:{ size:10 } }, grid:{ display:false } },
        y:{ ticks:{ color:TC, font:{ size:10 }, callback:v=>'₴'+Math.round(v/1000)+'K' }, grid:{ color:GC } } } }
    });

    mkChart('effChart', {
      type:'line',
      data:{ labels:MONTHS, datasets:[
        { label:'Маржа %',       data:[62,65,60,67,63,68,66,63,69,72,68,66], borderColor:'#2A6E46', tension:.4, pointRadius:3, fill:false },
        { label:'Ефективність %',data:[75,78,72,80,76,82,79,74,83,85,80,73], borderColor:'#1C1A16', tension:.4, pointRadius:3, fill:false },
      ]},
      options:{ responsive:true, plugins:{ legend:{ labels:{ color:TC, font:{ family:FONT, size:11 } } } },
        scales:{ x:{ ticks:{ color:TC, font:{ size:10 } }, grid:{ color:GC } },
                 y:{ ticks:{ color:TC, font:{ size:10 }, callback:v=>v+'%' }, grid:{ color:GC } } } }
    });

    mkChart('expChart', {
      type:'bar',
      data:{ labels:DAYS, datasets:[{ label:'Денні витрати', data:[9.6,11.2,8.4,14.4,10.4,16,12,12].map(v=>v*1000), backgroundColor:'rgba(28,26,22,.65)', borderRadius:4 }] },
      options:{ responsive:true, plugins:{ legend:{ labels:{ color:TC, font:{ family:FONT, size:11 } } } },
        scales:{ x:{ ticks:{ color:TC, font:{ size:10 } }, grid:{ display:false } },
                 y:{ ticks:{ color:TC, font:{ size:10 }, callback:v=>'₴'+Math.round(v/1000)+'K' }, grid:{ color:GC } } } }
    });

    mkChart('revChart', {
      type:'bar',
      data:{ labels:MONTHS, datasets:[{ label:'Місячний дохід',
        data:[540,620,580,710,660,780,820,760,890,1160,884,996].map(v=>v*1000),
        backgroundColor:MONTHS.map((_,i) => i===11 ? '#1C1A16' : 'rgba(28,26,22,.2)'), borderRadius:4 }] },
      options:{ responsive:true, plugins:{ legend:{ labels:{ color:TC, font:{ family:FONT, size:11 } } } },
        scales:{ x:{ ticks:{ color:TC, font:{ size:10 } }, grid:{ display:false } },
                 y:{ ticks:{ color:TC, font:{ size:10 }, callback:v=>'₴'+Math.round(v/1000)+'K' }, grid:{ color:GC } } } }
    });

    mkChart('forecastChart', {
      type:'line',
      data:{ labels:['Трав','Черв','Лип','Серп','Вер','Жов'], datasets:[
        { label:'Прогноз доходу', data:[996,1100,1180,1240,1310,1400].map(v=>v*1000), borderColor:'#2A6E46', backgroundColor:'rgba(42,110,70,.06)', fill:true, tension:.4, pointRadius:3, pointBackgroundColor:'#2A6E46' },
        { label:'Прогноз витрат', data:[334,340,355,368,380,395].map(v=>v*1000),       borderColor:'#B83228', backgroundColor:'rgba(184,50,40,.04)', fill:true, tension:.4, pointRadius:3, borderDash:[4,4] },
        { label:'Оптимістичний',  data:[996,1150,1250,1340,1450,1580].map(v=>v*1000),  borderColor:'rgba(42,110,70,.3)', tension:.4, pointRadius:0, borderDash:[2,4], fill:false },
      ]},
      options:{ responsive:true, plugins:{ legend:{ labels:{ color:TC, font:{ family:FONT, size:11 } } } },
        scales:{ x:{ ticks:{ color:TC, font:{ size:10 } }, grid:{ color:GC } },
                 y:{ ticks:{ color:TC, font:{ size:10 }, callback:v=>'₴'+Math.round(v/1000)+'K' }, grid:{ color:GC } } } }
    });

    mkChart('benchChart', {
      type:'bar',
      data:{ labels:['SaaS','Маркетинг','Зарплати','Офіс','Інфра'], datasets:[
        { label:'Ваша компанія',    data:[93600,48000,140000,24800,33600], backgroundColor:'rgba(44,40,32,.75)', borderRadius:4 },
        { label:'Середнє по ринку', data:[68000,54000,138000,22000,28000], backgroundColor:'rgba(196,180,140,.5)', borderRadius:4 },
      ]},
      options:{ responsive:true, plugins:{ legend:{ labels:{ color:TC, font:{ family:FONT, size:11 } } } },
        scales:{ x:{ ticks:{ color:TC, font:{ size:10 } }, grid:{ display:false } },
                 y:{ ticks:{ color:TC, font:{ size:10 }, callback:v=>'₴'+Math.round(v/1000)+'K' }, grid:{ color:GC } } } }
    });

  } catch (e) {
    console.error('Chart init error:', e);
  }
}

// ══ API KEY ══
function saveApiKey() {
  const input = $('apiKeyInput');
  if (!input) return;
  const key = input.value.trim();
  if (!key.startsWith('sk-ant-')) {
    const s = $('apiStatus');
    if (s) { s.textContent = 'Невірний ключ'; s.style.color = 'var(--red)'; }
    return;
  }
  state.apiKey = key;
  input.value = '•'.repeat(16);
  const s = $('apiStatus');
  if (s) { s.textContent = 'Ключ збережено — AI готовий'; s.style.color = '#6EE7A0'; }
}

async function callClaude(system, messages, maxTokens = 800) {
  if (!state.apiKey) throw new Error('Введіть API ключ у верхньому рядку щоб активувати AI');
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': state.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: CFG.CLAUDE_MODEL, max_tokens: maxTokens, system, messages }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${resp.status}`);
  }
  const data = await resp.json();
  if (data.error) throw new Error(data.error.message);
  return data.content.map(b => b.text || '').join('');
}

// ══ AI AUDIT ══
function loadEx() {
  const el = $('auditTx');
  if (el) el.value = `01.05 Figma Pro x8 -₴4,480\n02.05 Zoom Business -₴3,560\n03.05 AWS Cloud -₴16,800\n05.05 Оплата Acme +₴128,000\n07.05 Tableau -₴5,840\n08.05 Slack Business+ -₴7,500\n10.05 Microsoft Teams -₴3,680\n12.05 Adobe CC 15 -₴12,800`;
}

function animLoad() {
  const ids = ['l1','l2','l3','l4','l5'];
  let i = 0;
  return new Promise(res => {
    const iv = setInterval(() => {
      if (i > 0) {
        const prev = $(ids[i-1]);
        if (prev) { prev.classList.remove('on'); prev.classList.add('ok'); const dot = prev.querySelector('.ls-dot'); if (dot) dot.style.background = 'var(--green)'; }
      }
      if (i < ids.length) { const cur = $(ids[i]); if (cur) cur.classList.add('on'); }
      i++;
      if (i > ids.length) { clearInterval(iv); res(); }
    }, 560);
  });
}

function auditFallback() {
  return {
    totalSavings: 14280,
    issueCount: 4,
    summary: 'Виявлено дублікати комунікаційних інструментів та неефективне використання ліцензій. Загальна потенційна економія ₴14,280 на місяць.',
    issues: [
      { type:'crit', title:'Дублювання — Zoom + Teams',    description:'Обидва інструменти для відеодзвінків. Залиш той, яким користується команда.', savingsPerMonth:3560 },
      { type:'crit', title:'Figma — 3 зайві місця',        description:'8 місць оплачено, 5 активних. Знизь план.',                                    savingsPerMonth:4480 },
      { type:'warn', title:'Tableau — 47 днів без входу',  description:'Ніхто не заходив. Розглянь скасування або безкоштовну альтернативу.',          savingsPerMonth:5840 },
      { type:'info', title:'Оптимізація планів підписок',  description:'Деякі підписки розраховані на більшу команду.',                                 savingsPerMonth:400  },
    ],
  };
}

async function runAudit() {
  const txEl = $('auditTx');
  const tx = txEl?.value.trim();
  if (!tx) { showToast('Вставте транзакції для аналізу', 'error'); return; }

  const biz  = $('aBiz')?.value || 'IT / Стартап';
  const team = $('aTeam')?.value || '6–20 осіб';

  document.querySelector('.audit-form')?.style.setProperty('display','none');
  $('aLdg')?.classList.add('on');
  $('aRes')?.classList.remove('on');

  const prompt = `Ти — AI-агент SpenScan для аудиту бізнес-витрат в Україні.\nБізнес: ${biz}, команда: ${team}\nТранзакції:\n${tx}\nВідповідай ТІЛЬКИ JSON без markdown:\n{"totalSavings":число,"issueCount":число,"summary":"2-3 речення","issues":[{"type":"crit|warn|info","title":"назва","description":"опис","savingsPerMonth":число}]}\nСуми в гривнях. Відповідай українською.`;

  try {
    // Run animation and API call in parallel — fixed race condition
    const [, raw] = await Promise.all([
      animLoad(),
      callClaude('', [{ role:'user', content:prompt }], 1500).catch(() => null),
    ]);
    let result;
    if (raw) {
      try { result = JSON.parse(raw.replace(/```json|```/g,'').trim()); }
      catch { result = auditFallback(); }
    } else {
      result = auditFallback();
    }
    showAuditResult(result);
  } catch {
    showAuditResult(auditFallback());
  }
}

function showAuditResult(r) {
  $('aLdg')?.classList.remove('on');
  setText('aSaveNum', '₴' + (r.totalSavings || 0).toLocaleString('uk-UA'));
  setText('aSumText', r.summary || '');

  const list = $('aIssues');
  if (list) {
    list.innerHTML = '';
    (r.issues || []).forEach(iss => {
      const row = document.createElement('div');
      row.className = 'ai-row ' + (iss.type === 'crit' || iss.type === 'warn' || iss.type === 'info' ? iss.type : 'info');

      const left = document.createElement('div');
      const t = document.createElement('div'); t.className = 'ai-t'; t.textContent = iss.title || '';
      const d = document.createElement('div'); d.className = 'ai-d'; d.textContent = iss.description || '';
      left.appendChild(t); left.appendChild(d);
      row.appendChild(left);

      if ((iss.savingsPerMonth || 0) > 0) {
        const s = document.createElement('div'); s.className = 'ai-s';
        s.textContent = '-₴' + iss.savingsPerMonth.toLocaleString('uk-UA') + '/міс';
        row.appendChild(s);
      }
      list.appendChild(row);
    });
  }
  $('aRes')?.classList.add('on');
}

function copyAudit() {
  const num     = $('aSaveNum')?.textContent || '';
  const summary = $('aSumText')?.textContent || '';
  const text = `ЗВІТ SPENSCAN\nЕкономія: ${num}/міс\n\n${summary}\n\nspenscan.ua`;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => showToast('Скопійовано у буфер', 'success'))
      .catch(() => legacyCopy(text));
  } else {
    legacyCopy(text);
  }
}

function legacyCopy(text) {
  const ta = Object.assign(document.createElement('textarea'), { value: text });
  ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); showToast('Скопійовано у буфер', 'success'); }
  catch { showToast('Не вдалось скопіювати', 'error'); }
  ta.remove();
}

function resetAudit() {
  $('aRes')?.classList.remove('on');
  $('aLdg')?.classList.remove('on');
  const form = document.querySelector('.audit-form');
  if (form) form.style.display = 'block';
  document.querySelectorAll('.ls').forEach(s => {
    s.className = 'ls';
    const dot = s.querySelector('.ls-dot');
    if (dot) dot.style.background = '';
  });
}

// ══ AI ASSISTANT ══
function addMsg(text, role) {
  const msgs = $('chat-messages');
  if (!msgs) return null;
  const div = document.createElement('div');
  div.className = 'chat-msg ' + role;
  div.textContent = text;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

function quickQ(btn) {
  const input = $('chatInput');
  if (input) { input.value = btn.textContent.trim(); sendChat(); }
}

function quickQText(text) {
  const input = $('chatInput');
  if (input) { input.value = text; sendChat(); }
}

async function sendChat() {
  const input = $('chatInput');
  const text  = input?.value.trim();
  if (!text) return;
  input.value = '';

  addMsg(text, 'user');

  // Cap history to avoid huge API payloads
  if (state.chatHistory.length >= CFG.CHAT_HISTORY_LIMIT) state.chatHistory.splice(0, 2);
  state.chatHistory.push({ role:'user', content:text });

  const typing = addMsg('AI аналізує...', 'typing');

  const system = `Ти — AI фінансовий директор компанії SpenScan. Відповідай як досвідчений CFO.
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
    const reply = await callClaude(system, state.chatHistory, 600);
    typing?.remove();
    addMsg(reply, 'ai');
    state.chatHistory.push({ role:'assistant', content:reply });
  } catch (e) {
    typing?.remove();
    addMsg('Помилка: ' + (e.message || 'перевірте API ключ'), 'ai');
  }
}

// ══ BANK MODAL ══
const BANKS = {
  DE:[
    {id:'DEUTSCHE_BANK',name:'Deutsche Bank',   color:'#003A82',abbr:'DB'},
    {id:'N26',          name:'N26',              color:'#26B5A0',abbr:'N26'},
    {id:'ING_DE',       name:'ING Deutschland',  color:'#FF6200',abbr:'ING'},
    {id:'COMMERZBANK',  name:'Commerzbank',      color:'#FFCC00',abbr:'CB'},
    {id:'SPARKASSE',    name:'Sparkasse',        color:'#FF0000',abbr:'SP'},
    {id:'DKB',          name:'DKB Bank',         color:'#1E3A5F',abbr:'DKB'},
  ],
  PL:[
    {id:'PKO',          name:'PKO Bank Polski',  color:'#003087',abbr:'PKO'},
    {id:'MBANK',        name:'mBank',            color:'#E2001A',abbr:'mB'},
    {id:'ING_PL',       name:'ING Bank Śląski',  color:'#FF6200',abbr:'ING'},
    {id:'SANTANDER_PL', name:'Santander Bank Polska',color:'#EC0000',abbr:'SAN'},
    {id:'MILLENNIUM',   name:'Bank Millennium',  color:'#E60028',abbr:'MIL'},
    {id:'ALIOR',        name:'Alior Bank',       color:'#E30613',abbr:'ALI'},
  ],
  GB:[
    {id:'BARCLAYS',name:'Barclays',      color:'#00AEEF',abbr:'BAR'},
    {id:'HSBC',    name:'HSBC',          color:'#DB0011',abbr:'HSBC'},
    {id:'MONZO',   name:'Monzo',         color:'#FF3464',abbr:'MNZ'},
    {id:'STARLING',name:'Starling Bank', color:'#6935D3',abbr:'STL'},
    {id:'LLOYDS',  name:'Lloyds Bank',   color:'#006A4D',abbr:'LLY'},
    {id:'NATWEST', name:'NatWest',       color:'#42145F',abbr:'NW'},
  ],
  IE:[
    {id:'AIB',   name:'AIB Bank',       color:'#004F9F',abbr:'AIB'},
    {id:'BOI',   name:'Bank of Ireland',color:'#004D40',abbr:'BOI'},
    {id:'ULSTER',name:'Ulster Bank',    color:'#5C2D91',abbr:'ULB'},
    {id:'PTSB',  name:'Permanent TSB',  color:'#E31837',abbr:'TSB'},
    {id:'KBC_IE',name:'KBC Ireland',    color:'#00A2E2',abbr:'KBC'},
  ],
  CZ:[
    {id:'CESKA',   name:'Česká spořitelna', color:'#E2001A',abbr:'CS'},
    {id:'CSOB',    name:'ČSOB',             color:'#004B87',abbr:'ČSOB'},
    {id:'KOMERCNI',name:'Komerční banka',   color:'#E2001A',abbr:'KB'},
    {id:'MONETA',  name:'Moneta Money Bank',color:'#E2001A',abbr:'MNT'},
  ],
  NL:[
    {id:'ING_NL',name:'ING Bank',   color:'#FF6200',abbr:'ING'},
    {id:'ABN',   name:'ABN AMRO',  color:'#009900',abbr:'ABN'},
    {id:'RABO',  name:'Rabobank',  color:'#E2001A',abbr:'RAB'},
    {id:'SNS',   name:'SNS Bank',  color:'#E2001A',abbr:'SNS'},
  ],
  EU:[
    {id:'REVOLUT',name:'Revolut Business',color:'#191C1F',abbr:'REV'},
    {id:'WISE',   name:'Wise Business',   color:'#00B9FF',abbr:'WISE'},
    {id:'BUNQ',   name:'Bunq',            color:'#00C4B4',abbr:'BNQ'},
    {id:'PAYSERA',name:'Paysera',         color:'#0072C6',abbr:'PAY'},
  ],
  OTHER:[
    {id:'REVOLUT',    name:'Revolut Business',color:'#191C1F',abbr:'REV'},
    {id:'WISE',       name:'Wise Business',   color:'#00B9FF',abbr:'WISE'},
    {id:'UNICREDIT',  name:'UniCredit',       color:'#E2001A',abbr:'UNI'},
    {id:'RAIFFEISEN', name:'Raiffeisen Bank', color:'#FFD700',abbr:'RAI'},
    {id:'ERSTE',      name:'Erste Bank',      color:'#E2001A',abbr:'EB'},
  ],
};

function openBankModal()  { const m = $('bankModal'); if (m) { m.style.display = 'flex'; renderBankList(); } }
function closeBankModal() {
  const m = $('bankModal');
  if (m) m.style.display = 'none';
  if (state.connectTimer) { clearTimeout(state.connectTimer); state.connectTimer = null; }
  goStep(1);
  state.selectedBank = null;
  const nx = $('step2Next');
  if (nx) { nx.disabled = true; nx.style.opacity = '.4'; }
}

function selectCountry(el, code) {
  document.querySelectorAll('.bank-country-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  state.selectedCountry = code;
  renderBankList();
}

const renderBankListDebounced = debounce(_renderBankList, 150);

function _renderBankList() {
  const banks    = BANKS[state.selectedCountry] || [];
  const q        = ($('bankSearch')?.value || '').toLowerCase();
  const filtered = banks.filter(b => b.name.toLowerCase().includes(q));
  const list     = $('bankList');
  if (!list) return;

  // Build DOM — no innerHTML with variable data (avoids XSS)
  list.innerHTML = '';
  filtered.forEach(b => {
    const item = document.createElement('div');
    item.className = 'bank-item';
    item.dataset.id = b.id;

    const logo = document.createElement('div');
    logo.className = 'bank-logo';
    logo.style.background = b.color + '20';
    logo.style.color       = b.color;
    logo.style.border      = `1px solid ${b.color}30`;
    logo.textContent       = b.abbr;

    const info = document.createElement('div');
    info.style.flex = '1';
    const nm = document.createElement('div'); nm.className = 'bank-item-name'; nm.textContent = b.name;
    const sb = document.createElement('div'); sb.className = 'bank-item-sub';  sb.textContent = 'Open Banking · PSD2';
    info.appendChild(nm); info.appendChild(sb);

    const chk = document.createElement('div');
    chk.className = 'bank-item-check';

    item.appendChild(logo); item.appendChild(info); item.appendChild(chk);
    item.addEventListener('click', () => selectBank(item, b.id, b.name));
    list.appendChild(item);
  });
}

function renderBankList() { renderBankListDebounced(); }
function filterBanks()    { renderBankListDebounced(); }

function selectBank(el, id, name) {
  document.querySelectorAll('.bank-item').forEach(i => {
    i.classList.remove('selected');
    const c = i.querySelector('.bank-item-check'); if (c) c.textContent = '';
  });
  el.classList.add('selected');
  const c = el.querySelector('.bank-item-check'); if (c) c.textContent = '✓';
  state.selectedBank = { id, name };
  const nx = $('step2Next');
  if (nx) { nx.disabled = false; nx.style.opacity = '1'; }
  setText('selectedBankName', name);
}

function goStep(n) {
  [$('bankStep1'), $('bankStep2'), $('bankStep3')].forEach((el, i) => {
    if (el) el.style.display = (i + 1 === n) ? 'block' : 'none';
  });
  ['bstep1','bstep2','bstep3'].forEach((id, i) => {
    const el = $(id); if (!el) return;
    el.className = 'bank-step-dot' + (i+1 < n ? ' done' : i+1 === n ? ' active' : '');
  });
  ['bline1','bline2'].forEach((id, i) => {
    const el = $(id); if (!el) return;
    el.className = 'bank-step-line' + (i+1 < n ? ' done' : '');
  });
  if (n === 3) {
    const show = id => { const e = $(id); if (e) e.style.display = 'block'; };
    const hide = id => { const e = $(id); if (e) e.style.display = 'none'; };
    show('connectingState'); hide('loadingState'); hide('successState');
    const sb = $('step3Btns'); if (sb) sb.style.display = 'grid';
  }
}

async function connectBank() {
  if (!state.selectedBank) return;

  $('connectingState') && ($('connectingState').style.display = 'none');
  $('step3Btns')       && ($('step3Btns').style.display       = 'none');
  $('loadingState')    && ($('loadingState').style.display    = 'block');

  const steps = [
    "Встановлення захищеного з'єднання...",
    'Авторизація через Open Banking...',
    'Отримання списку рахунків...',
    'Завантаження транзакцій...',
    'Аналіз даних...',
  ];
  for (const step of steps) {
    setText('loadingText', step);
    await new Promise(r => setTimeout(r, 700));
  }

  $('loadingState')  && ($('loadingState').style.display  = 'none');
  $('successState')  && ($('successState').style.display  = 'block');

  const txTarget  = Math.floor(Math.random() * 400) + 500;
  const accTarget = Math.floor(Math.random() * 3) + 1;
  animCounter('txCount',   txTarget,  1200);
  animCounter('accCount',  accTarget,  600);
  animCounter('daysCount', 90,         900);

  setText('successMsg',  state.selectedBank.name + ' успішно підключено!');
  setText('sbBankName',  state.selectedBank.name);
  setText('sbBankSync',  'Щойно синхронізовано');
  const dot = document.querySelector('.sb-live-dot');
  if (dot) dot.style.background = '#6EE7A0';

  const bankName = state.selectedBank.name;
  state.connectTimer = setTimeout(() => {
    closeBankModal();
    showBankNotification(bankName, txTarget);
  }, 2500);
}

function animCounter(id, target, duration) {
  const el = $(id);
  if (!el) return;
  const step = target / (duration / 16);
  let cur = 0;
  const timer = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = Math.round(cur);
    if (cur >= target) clearInterval(timer);
  }, 16);
}

function showBankNotification(bankName, txCount) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;bottom:80px;right:24px;background:var(--ink);color:var(--cream);padding:14px 18px;border-radius:12px;z-index:999;box-shadow:0 8px 24px rgba(0,0,0,.2);max-width:280px;';
  const lbl = document.createElement('div');
  lbl.style.cssText = 'font-size:11px;color:rgba(255,255,255,.4);margin-bottom:3px;font-weight:700;';
  lbl.textContent = 'БАНК ПІДКЛЮЧЕНО';
  const msg = document.createElement('div');
  msg.style.cssText = 'font-size:13px;font-weight:600;';
  msg.textContent = bankName + ' — завантажено ' + txCount + ' транзакцій';
  wrap.appendChild(lbl); wrap.appendChild(msg);
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 4000);
}

// ══ WHAT IF ══
function updateWhatIf() {
  const expEl  = $('expChange');
  const revEl  = $('revChange');
  const hireEl = $('hireChange');
  if (!expEl || !revEl || !hireEl) return;

  const exp  = parseInt(expEl.value,  10);
  const rev  = parseInt(revEl.value,  10);
  const hire = parseInt(hireEl.value, 10);

  setText('expVal',  (exp  >= 0 ? '+' : '') + exp  + '%');
  setText('revVal',  (rev  >= 0 ? '+' : '') + rev  + '%');
  setText('hireVal', hire + ' осіб');

  const newRev    = CFG.BASE_REVENUE   * (1 + rev  / 100);
  const newExp    = CFG.BASE_EXPENSES  * (1 + exp  / 100) + hire * CFG.SALARY_PER_PERSON;
  const newProfit = newRev - newExp;
  const newBurn   = newExp / 30;
  const newRunway = newBurn > 0 ? CFG.BASE_BALANCE / newBurn : 999;
  const newScore  = Math.max(30, Math.min(100, 73 - exp / 3 + rev / 4 - hire * 1.5));

  const rwEl = $('wi-runway');
  if (rwEl) { rwEl.textContent = newRunway.toFixed(1) + ' міс'; rwEl.style.color = newRunway > 10 ? 'var(--green)' : newRunway > 6 ? 'var(--amber)' : 'var(--red)'; }
  const prEl = $('wi-profit');
  if (prEl) { prEl.textContent = '₴' + Math.round(newProfit/1000) + 'K'; prEl.style.color = newProfit > 0 ? 'var(--green)' : 'var(--red)'; }
  setText('wi-burn', '₴' + Math.round(newBurn/1000) + 'K/д');
  const scEl = $('wi-score');
  if (scEl) { scEl.textContent = Math.round(newScore); scEl.style.color = newScore > 75 ? 'var(--green)' : newScore > 55 ? 'var(--amber)' : 'var(--red)'; }

  const vd = $('wi-verdict');
  if (!vd) return;
  let [bg, bc, color, txt] = newRunway < 4
    ? ['var(--red-bg)',   '#F0C4C0', 'var(--red)',   'Критичний сценарій: runway менше 4 місяців. Термінова оптимізація витрат або залучення інвестицій.']
    : newRunway < 7
    ? ['var(--amber-bg)', '#F0DDB8', 'var(--amber)', 'Ризикований сценарій: runway нижче 7 місяців. Рекомендуємо скоротити витрати або прискорити залучення доходу.']
    : newProfit > 800000
    ? ['var(--green-bg)', '#B8DFC5', 'var(--green)', `Відмінний сценарій! Runway ${newRunway.toFixed(1)} місяців, прибуток зростає. Можна розглянути найм або нові інвестиції.`]
    : ['var(--amber-bg)', '#F0DDB8', 'var(--amber)', `Стабільний сценарій. Runway ${newRunway.toFixed(1)} місяців. Слідкуйте за балансом витрат і доходу.`];
  Object.assign(vd.style, { background:bg, borderColor:bc, color });
  vd.textContent = txt;
}

function setScenario(exp, rev, hire) {
  const expEl = $('expChange'), revEl = $('revChange'), hireEl = $('hireChange');
  if (expEl)  expEl.value  = exp;
  if (revEl)  revEl.value  = rev;
  if (hireEl) hireEl.value = hire;
  updateWhatIf();
}

// ══ PWA INSTALL ══
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = $('installBtn');
  if (btn) btn.style.display = 'flex';
});

function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(() => {
    deferredPrompt = null;
    const btn = $('installBtn');
    if (btn) btn.style.display = 'none';
  });
}

// ══ EVENT LISTENERS ══
function initListeners() {
  $('overlay')?.addEventListener('click', closeSb);
  document.querySelector('.tb-menu')?.addEventListener('click', openSb);

  // Sidebar navigation via data-page attribute (replaces inline onclick)
  document.querySelectorAll('.sb-item[data-page]').forEach(item => {
    item.addEventListener('click', () => nav(item.dataset.page, item));
  });

  // Period tabs
  document.querySelector('.period-tabs')?.addEventListener('click', e => {
    const tab = e.target.closest('.ptab');
    if (tab) setPer(tab);
  });

  // API key — save on Enter
  $('apiKeyInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') saveApiKey(); });

  // API banner close
  $('apiBannerClose')?.addEventListener('click', () => { $('apiBanner').style.display = 'none'; });

  // Chat Enter key
  $('chatInput')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });

  // What If sliders
  ['expChange','revChange','hireChange'].forEach(id => {
    $(id)?.addEventListener('input', updateWhatIf);
  });

  // Bank search (debounced via filterBanks)
  $('bankSearch')?.addEventListener('input', filterBanks);
}

// ══ INIT ══
document.addEventListener('DOMContentLoaded', () => {
  initTables();
  initAIRecs();
  initListeners();
  setTimeout(initCharts, CFG.CHART_INIT_DELAY);
});
