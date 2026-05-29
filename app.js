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
  serverKey: false,
  user: null,
  _authTab: 'login',
  sub: null, // { active, plan, email, customerId, periodEnd } — з localStorage
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
  subscription:'Підписка', settings:'Налаштування',
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
  subscription:'Поточний план та білінг', settings:'Конфігурація акаунту',
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

function saveApiKeyFromSettings() {
  const input = $('settingsApiKey');
  if (!input) return;
  const key = input.value.trim();
  if (!key.startsWith('sk-ant-')) { showToast('Невірний ключ — має починатись з sk-ant-', 'error'); return; }
  state.apiKey = key;
  const main = $('apiKeyInput');
  if (main) { main.value = '•'.repeat(16); }
  input.value = '•'.repeat(16);
  $('apiBanner') && ($('apiBanner').style.display = 'none');
  showToast('API ключ збережено — AI готовий', 'success');
}

async function callClaude(system, messages, maxTokens = 800) {
  // Пріоритет: ручний ключ користувача → серверний проксі
  if (state.apiKey) {
    return _claudeDirect(system, messages, maxTokens);
  }
  if (state.serverKey) {
    return _claudeProxy(system, messages, maxTokens);
  }
  throw new Error('Введіть API ключ щоб активувати AI');
}

async function _claudeProxy(system, messages, maxTokens) {
  const resp = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: CFG.CLAUDE_MODEL, max_tokens: maxTokens, system, messages }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    if (resp.status === 503) throw new Error('Серверний API ключ не налаштований — зверніться до адміністратора');
    throw new Error(err?.error?.message || `HTTP ${resp.status}`);
  }
  const data = await resp.json();
  if (data.error) throw new Error(data.error.message);
  return data.content.map(b => b.text || '').join('');
}

async function _claudeDirect(system, messages, maxTokens) {
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

// Перевірити серверний ключ при завантаженні
async function checkServerKey() {
  try {
    const r = await fetch('/api/claude');
    if (r.ok) {
      const d = await r.json();
      if (d.available) {
        state.serverKey = true;
        $('apiBanner') && ($('apiBanner').style.display = 'none');
        const s = $('apiStatus');
        if (s) { s.textContent = 'AI активний (серверний ключ)'; s.style.color = '#6EE7A0'; }
      }
    }
  } catch { /* localhost без проксі — показуємо банер */ }
}

// ══ STRIPE / SUBSCRIPTION ══

function loadSub() {
  try { state.sub = JSON.parse(localStorage.getItem('spenscan_sub') || 'null'); } catch { state.sub = null; }
}

function saveSub(data) {
  state.sub = data;
  localStorage.setItem('spenscan_sub', JSON.stringify(data));
}

function subPlan() {
  return state.sub?.active ? (state.sub.plan || 'starter') : null;
}

async function startCheckout(plan) {
  const btn = document.querySelector(`[data-checkout="${plan}"]`);
  if (btn) { btn.disabled = true; btn.textContent = 'Завантаження…'; }
  try {
    const r = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    const d = await r.json();
    if (!r.ok || !d.url) throw new Error(d.error || 'Помилка Stripe');
    window.location.href = d.url; // перехід на Stripe Checkout
  } catch (err) {
    showToast(err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || 'Підписатись'; }
  }
}

async function handleCheckoutReturn() {
  const params = new URLSearchParams(window.location.search);
  const status    = params.get('checkout');
  const sessionId = params.get('session_id');

  // Очистити URL без перезавантаження
  window.history.replaceState({}, '', window.location.pathname);

  if (status === 'cancel') {
    showToast('Оплату скасовано', 'info');
    return;
  }

  if (status === 'success' && sessionId) {
    showToast('Перевіряємо оплату…', 'info');
    try {
      const r = await fetch(`/api/verify?session_id=${encodeURIComponent(sessionId)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Помилка перевірки');
      if (d.active) {
        saveSub(d);
        renderSubPage();
        showToast(`Підписка ${d.plan === 'pro' ? 'Про' : 'Стартер'} активована! Дякуємо 🎉`, 'success');
        nav('subscription');
      } else {
        showToast('Оплата не підтверджена — спробуйте ще раз', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
}

function toggleBilling(yearly) {
  // Оновити ціни та data-checkout атрибути
  const track = $('billingTrack');
  const thumb = $('billingThumb');
  if (track) track.style.background = yearly ? 'var(--ink)' : 'var(--border)';
  if (thumb) thumb.style.transform   = yearly ? 'translateX(18px)' : '';

  const sPrice = $('priceStarter');
  const pPrice = $('pricePro');
  const sNote  = $('pricingNoteStarter');
  const pNote  = $('pricingNotePro');
  const sBtn   = document.querySelector('[data-checkout^="starter"]');
  const pBtn   = document.querySelector('[data-checkout^="pro"]');

  if (yearly) {
    if (sPrice) sPrice.textContent = '€12';
    if (pPrice) pPrice.textContent = '€27';
    if (sNote)  sNote.textContent  = '€144/рік — 2 місяці безкоштовно';
    if (pNote)  pNote.textContent  = '€324/рік — 3 місяці безкоштовно';
    if (sBtn)   sBtn.dataset.checkout = 'starter-yearly';
    if (pBtn)   pBtn.dataset.checkout = 'pro-yearly';
  } else {
    if (sPrice) sPrice.textContent = '€15';
    if (pPrice) pPrice.textContent = '€36';
    if (sNote)  sNote.textContent  = 'або €144/рік (−20%)';
    if (pNote)  pNote.textContent  = 'або €288/рік (−33%)';
    if (sBtn)   sBtn.dataset.checkout = 'starter-monthly';
    if (pBtn)   pBtn.dataset.checkout = 'pro-monthly';
  }
}

function renderSubPage() {
  const plan = subPlan();
  const pg = $('pg-subscription');
  if (!pg) return;

  const starterBtn = pg.querySelector('[data-checkout="starter-monthly"]');
  const proBtn     = pg.querySelector('[data-checkout="pro-monthly"]');
  const yearlyToggle = pg.querySelector('#billingToggle');

  if (!plan) return; // не підписаний — кнопки залишаються активними

  // Підсвітити активний план
  pg.querySelectorAll('.sub-plan-card').forEach(c => c.removeAttribute('data-active'));
  const activeCard = pg.querySelector(`[data-plan="${plan}"]`);
  if (activeCard) activeCard.setAttribute('data-active', '1');

  // Кнопки
  if (starterBtn) {
    if (plan === 'starter') { starterBtn.textContent = '✓ Ваш план'; starterBtn.disabled = true; }
    else { starterBtn.textContent = 'Понизити'; starterBtn.disabled = false; }
  }
  if (proBtn) {
    if (plan === 'pro') { proBtn.textContent = '✓ Ваш план'; proBtn.disabled = true; }
    else { proBtn.textContent = 'Оновити →'; proBtn.disabled = false; }
  }

  // Показати email і дату закінчення
  const infoEl = $('subActiveInfo');
  if (infoEl && state.sub) {
    const endDate = state.sub.periodEnd
      ? new Date(state.sub.periodEnd * 1000).toLocaleDateString('uk-UA')
      : '—';
    infoEl.innerHTML = `<span style="color:var(--green);font-weight:600;">● Активна</span> · ${esc(state.sub.email || '')} · наступне списання ${endDate}`;
    infoEl.style.display = 'flex';
  }
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
// ══ AUTH ══

function showAuthOverlay() {
  const o = $('authOverlay');
  if (o) o.style.display = 'block';
}

function hideAuthOverlay() {
  const o = $('authOverlay');
  if (o) o.style.display = 'none';
}

function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  const loginBtn  = $('authTabLogin');
  const signupBtn = $('authTabSignup');
  const submitBtn = $('authSubmitBtn');
  const active  = 'background:var(--white);font-weight:700;color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.07);';
  const passive = 'background:none;font-weight:600;color:var(--warm);box-shadow:none;';
  if (loginBtn)  loginBtn.style.cssText  += isLogin  ? active : passive;
  if (signupBtn) signupBtn.style.cssText += !isLogin ? active : passive;
  if (submitBtn) submitBtn.textContent = isLogin ? 'Увійти' : 'Створити акаунт';
  const pwdInput = $('authPassword');
  if (pwdInput) pwdInput.autocomplete = isLogin ? 'current-password' : 'new-password';
  $('authError') && ($('authError').style.display = 'none');
  state._authTab = tab;
}

async function submitAuth() {
  const email    = ($('authEmail')?.value    || '').trim();
  const password = ($('authPassword')?.value || '').trim();
  const action   = state._authTab || 'login';
  const errEl    = $('authError');
  const btn      = $('authSubmitBtn');

  if (!email || !password) {
    if (errEl) { errEl.textContent = 'Заповніть всі поля'; errEl.style.display = 'block'; }
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  if (errEl) errEl.style.display = 'none';

  try {
    const r = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, email, password }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Помилка авторизації');

    localStorage.setItem('spenscan_token', d.token);
    state.user = { email };
    hideAuthOverlay();
    showToast(`Ласкаво просимо, ${email}`, 'success');
  } catch (err) {
    if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = action === 'login' ? 'Увійти' : 'Створити акаунт'; }
  }
}

function logout() {
  localStorage.removeItem('spenscan_token');
  state.user = null;
  showAuthOverlay();
  showToast('Ви вийшли з акаунту', 'info');
}

async function initAuth() {
  const token = localStorage.getItem('spenscan_token');
  if (!token) { showAuthOverlay(); return; }

  try {
    const r = await fetch('/api/auth', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error();
    const user = await r.json();
    state.user = user;
    hideAuthOverlay();
  } catch {
    localStorage.removeItem('spenscan_token');
    showAuthOverlay();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initTables();
  initAIRecs();
  initListeners();
  setTimeout(initCharts, CFG.CHART_INIT_DELAY);
  checkServerKey();
  loadSub();
  handleCheckoutReturn();
  renderSubPage();
  initAuth();
});

// ══════════════════════════════════════════════
// DRILL-DOWN SYSTEM + SPARKLINES + FILTER
// ══════════════════════════════════════════════

// ── Sparkline data (8 pts per KPI) ──
const SPARKLINE_DATA = {
  revenue:  [764,  820,  756,  910,  880, 1160,  884,  996],
  expenses: [268,  292,  272,  340,  316,  452,  340,  334],
  profit:   [496,  528,  484,  570,  564,  708,  544,  662],
  balance:  [2100, 2180, 2050, 2240, 2300, 2520, 2440, 2450],
  burn:     [8.9,  9.7,  9.1, 11.3, 10.5, 15.1, 11.3, 11.1],
};

// Positive = green line, negative = red line
const SPARKLINE_POSITIVE = { revenue:true, expenses:false, profit:true, balance:true, burn:false };

function mkSparklineSVG(data, w=80, h=28, positive=true) {
  if (!data || data.length < 2) return '';
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return [x, y];
  });
  const linePath = pts.map((p, i) => (i === 0 ? `M${p[0].toFixed(1)},${p[1].toFixed(1)}` : `L${p[0].toFixed(1)},${p[1].toFixed(1)}`)).join(' ');
  const areaPath = linePath + ` L${pts[pts.length-1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`;
  const stroke = positive ? '#2A6E46' : '#B83228';
  const fill   = positive ? 'rgba(42,110,70,.1)' : 'rgba(184,50,40,.1)';
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true" style="display:block;">
    <path d="${areaPath}" fill="${fill}"/>
    <path d="${linePath}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

// ── Hierarchical drill-down data ──
const DRILL_DATA = {
  revenue: {
    title:'Доходи', icon:'+', color:'#2A6E46',
    root:{
      summary:{ value:'₴996K', change:'+12.4%', positive:true },
      insight:'Дохід стабільно зростає 3 місяці поспіль. Рекордний квітень (+31%) завдяки розширенню контракту Beta Solutions. Прогноз на червень — ₴1.1M.',
      chart:[540,620,580,710,660,780,820,760,890,1160,884,996],
      chartLabels:['чер','лип','сер','вер','жов','лис','гру','січ','лют','бер','кві','тра'],
      items:[
        {id:'jan',label:'Січень 2026',  value:760000, change:+8.2},
        {id:'feb',label:'Лютий 2026',   value:890000, change:+17.1},
        {id:'mar',label:'Березень 2026',value:1160000,change:+30.3},
        {id:'apr',label:'Квітень 2026', value:884000, change:-23.8},
        {id:'may',label:'Травень 2026', value:996000, change:+12.7},
      ],
    },
    month:{
      may:{
        summary:{ value:'₴996K', change:'+12.7%', positive:true },
        insight:'Три великі клієнти сплатили у травні. Тиждень 3 — рекордний завдяки Beta Solutions (₴216K).',
        chart:[128,216,384,268],
        chartLabels:['Тиж 1','Тиж 2','Тиж 3','Тиж 4'],
        items:[
          {id:'w1',label:'Тиждень 1 (1–7 тра)',  value:128000,change:+5.2},
          {id:'w2',label:'Тиждень 2 (8–14 тра)', value:216000,change:+18.4},
          {id:'w3',label:'Тиждень 3 (15–21 тра)',value:384000,change:+22.1},
          {id:'w4',label:'Тиждень 4 (22–31 тра)',value:268000,change:+8.8},
        ],
      },
      apr:{
        summary:{ value:'₴884K', change:'-23.8%', positive:false },
        insight:'Квітень нижче рекордного березня. Gamma LLC відстрочила платіж на травень.',
        chart:[96,320,280,188],
        chartLabels:['Тиж 1','Тиж 2','Тиж 3','Тиж 4'],
        items:[
          {id:'w1',label:'Тиждень 1 (1–7 кві)', value:96000, change:-8.3},
          {id:'w2',label:'Тиждень 2 (8–14 кві)',value:320000,change:+15.2},
          {id:'w3',label:'Тиждень 3 (15–21 кві)',value:280000,change:-4.1},
          {id:'w4',label:'Тиждень 4 (22–30 кві)',value:188000,change:-9.6},
        ],
      },
    },
    week:{
      w1:{ summary:{value:'₴128K',change:'+5.2%',positive:true}, insight:'Перший тиждень — Acme Corp сплатила рахунок #1042.',
           chart:[0,0,128000,0,0,0,0], chartLabels:['Пн','Вт','Ср','Чт','Пт','Сб','Нд'],
           items:[{id:'tx1',label:'Acme Corp — рахунок #1042',value:128000,change:0,date:'Ср, 3 тра',drillable:false}],},
      w2:{ summary:{value:'₴216K',change:'+18.4%',positive:true}, insight:'Beta Solutions підтвердила оплату великого контракту.',
           chart:[0,0,0,0,216000,0,0], chartLabels:['Пн','Вт','Ср','Чт','Пт','Сб','Нд'],
           items:[{id:'tx2',label:'Beta Solutions Ltd',value:216000,change:0,date:'Пт, 12 тра',drillable:false}],},
      w3:{ summary:{value:'₴384K',change:'+22.1%',positive:true}, insight:'Найкращий тиждень — два великих клієнти + передоплата.',
           chart:[0,96000,0,192000,96000,0,0], chartLabels:['Пн','Вт','Ср','Чт','Пт','Сб','Нд'],
           items:[
             {id:'tx3',label:'Gamma LLC — рахунок #3012', value:96000, change:0,date:'Вт, 16 тра',drillable:false},
             {id:'tx4',label:'Delta Corp — передоплата',  value:192000,change:0,date:'Чт, 18 тра',drillable:false},
             {id:'tx5',label:'Sigma Tech — рахунок #4401',value:96000, change:0,date:'Пт, 19 тра',drillable:false},
           ],},
      w4:{ summary:{value:'₴268K',change:'+8.8%',positive:true}, insight:'Стабільний тиждень. Очікується ще один платіж від Delta Corp.',
           chart:[0,128000,0,0,140000,0,0], chartLabels:['Пн','Вт','Ср','Чт','Пт','Сб','Нд'],
           items:[
             {id:'tx6',label:'Omega Partners — рахунок #2234',value:128000,change:0,date:'Вт, 23 тра',drillable:false},
             {id:'tx7',label:'Kappa Corp — рахунок #1891',    value:140000,change:0,date:'Пт, 26 тра',drillable:false},
           ],},
    },
  },

  expenses: {
    title:'Витрати', icon:'-', color:'#B83228',
    root:{
      summary:{ value:'₴334K', change:'+18.2%', positive:false },
      insight:'Витрати ростуть швидше за дохід (+18.2% vs +12.4%). SaaS підписки перевищили бюджет на 17%. AI виявив ₴14,280/міс потенційної економії у 4 категоріях.',
      chart:[248,268,244,292,272,316,328,304,348,452,340,334],
      chartLabels:['чер','лип','сер','вер','жов','лис','гру','січ','лют','бер','кві','тра'],
      items:[
        {id:'saas',   label:'SaaS та підписки', value:93600, change:+32.0, flag:'warn'},
        {id:'salary', label:'Зарплати',         value:140000,change:0},
        {id:'mkt',    label:'Маркетинг',        value:48000, change:-8.0},
        {id:'infra',  label:'Інфраструктура',   value:33600, change:+185.0, flag:'crit'},
        {id:'office', label:'Офіс',             value:24800, change:+1.0},
        {id:'travel', label:'Подорожі',         value:13600, change:-15.0},
      ],
    },
    category:{
      saas:{
        summary:{value:'₴93,600',change:'+32%',positive:false},
        insight:'SaaS витрати на 35% вище ринку. Zoom дублює Teams, Tableau 47 днів без входу. Потенційна економія ₴13,840/міс за рахунок 3 сервісів.',
        chart:[52000,58000,62000,71000,74000,82000,89000,93600],
        chartLabels:['жов','лис','гру','січ','лют','бер','кві','тра'],
        items:[
          {id:'slack',  label:'Slack Business+',   value:7500, change:+22.0,flag:'warn'},
          {id:'figma',  label:'Figma Pro x8',      value:4480, change:0,    flag:'warn'},
          {id:'zoom',   label:'Zoom Business',     value:3560, change:0,    flag:'crit'},
          {id:'tableau',label:'Tableau',           value:5840, change:0,    flag:'crit'},
          {id:'adobe',  label:'Adobe CC x15',      value:12800,change:+8.0},
          {id:'gw',     label:'Google Workspace',  value:5760, change:0},
          {id:'gh',     label:'GitHub Enterprise', value:8400, change:0},
          {id:'other',  label:'Інші (16 сервісів)',value:45260,change:+5.0},
        ],
      },
      infra:{
        summary:{value:'₴33,600 / міс',change:'+185%',positive:false},
        insight:'Аномальне зростання AWS витрат — +185% за 2 дні. Можливе неконтрольоване масштабування або витік конфігурації. Потребує негайної перевірки.',
        chart:[11200,11200,12600,12600,14400,16800,16800,48000],
        chartLabels:['Пн','Вт','Ср','Чт','Пт','Сб','Нд','Пн'],
        items:[
          {id:'aws',label:'AWS Cloud Services',value:48000,change:+185.0,flag:'crit'},
          {id:'gcp',label:'Google Cloud',      value:4800, change:+12.0},
          {id:'cf', label:'Cloudflare',        value:800,  change:0},
        ],
      },
      mkt:{
        summary:{value:'₴48,000',change:'-8%',positive:true},
        insight:'Маркетинговий бюджет використано на 80%. Ефективність зросла: CPA знизився на 12%. Рекомендуємо збільшити бюджет на ₴10K.',
        chart:[56000,54000,50000,52000,54000,52000,52000,48000],
        chartLabels:['жов','лис','гру','січ','лют','бер','кві','тра'],
        items:[
          {id:'gads', label:'Google Ads',     value:16000,change:-12.0},
          {id:'fbads',label:'Meta Ads',       value:12000,change:-5.0},
          {id:'seo',  label:'SEO / контент',  value:8000, change:0},
          {id:'email',label:'Email маркетинг',value:4000, change:+8.0},
          {id:'pr',   label:'PR / медіа',     value:8000, change:+5.0},
        ],
      },
      salary:{
        summary:{value:'₴140,000',change:'0%',positive:true},
        insight:'Зарплатний фонд стабільний. 12 співробітників. Revenue per employee ₴83K — нижче топ-перформерів у галузі (₴120K+).',
        chart:[140000,140000,140000,140000,140000,140000,140000,140000],
        chartLabels:['жов','лис','гру','січ','лют','бер','кві','тра'],
        items:[
          {id:'dev',   label:'Розробка (5 осіб)',value:65000,change:0},
          {id:'sales', label:'Продажі (3 особи)', value:39000,change:0},
          {id:'mkthr', label:'Маркетинг (2 особи)',value:24000,change:0},
          {id:'ops',   label:'Операції (2 особи)', value:12000,change:0},
        ],
      },
    },
    merchant:{
      slack:{
        summary:{value:'₴7,500/міс',change:'+22%',positive:false},
        insight:'Slack Business+ піднявся на 22% у березні без попередження. Renewal 3 червня — ₴45,600/рік. Рекомендуємо перейти на Microsoft Teams (вже оплачено) або Discord.',
        chart:[6150,6150,6150,7500,7500,7500,7500,7500],
        chartLabels:['жов','лис','гру','бер','кві-1','кві-2','тра-1','тра-2'],
        items:[
          {id:'slk1',label:'Slack Business+ — квітень',value:7500,change:+22.0,date:'1 кві 2026',drillable:false},
          {id:'slk2',label:'Slack Business+ — березень',value:7500,change:+22.0,date:'1 бер 2026',drillable:false},
          {id:'slk3',label:'Slack Business+ — лютий',value:6150,change:0,date:'1 лют 2026',drillable:false},
        ],
      },
      zoom:{
        summary:{value:'₴3,560/міс',change:'0%',positive:true},
        insight:'Zoom Business дублює Microsoft Teams. Команда використовує Teams у 89% дзвінків. Скасування Zoom заощадить ₴42,720/рік.',
        chart:[3560,3560,3560,3560,3560,3560,3560,3560],
        chartLabels:['жов','лис','гру','січ','лют','бер','кві','тра'],
        items:[
          {id:'zm1',label:'Zoom Business — травень',value:3560,change:0,date:'1 тра 2026',drillable:false},
          {id:'zm2',label:'Zoom Business — квітень',value:3560,change:0,date:'1 кві 2026',drillable:false},
          {id:'zm3',label:'Zoom Business — березень',value:3560,change:0,date:'1 бер 2026',drillable:false},
        ],
      },
      tableau:{
        summary:{value:'₴5,840/міс',change:'0%',positive:false},
        insight:'Tableau не використовувався 47 днів. Looker Studio (безкоштовно) покриває 95% потреб. Скасування заощадить ₴70,080/рік.',
        chart:[5840,5840,5840,5840,5840,5840,5840,5840],
        chartLabels:['жов','лис','гру','січ','лют','бер','кві','тра'],
        items:[
          {id:'tb1',label:'Tableau — травень',   value:5840,change:0,date:'1 тра 2026',drillable:false},
          {id:'tb2',label:'Tableau — квітень',  value:5840,change:0,date:'1 кві 2026',drillable:false},
          {id:'tb3',label:'Tableau — березень', value:5840,change:0,date:'1 бер 2026',drillable:false},
        ],
      },
      aws:{
        summary:{value:'₴48,000',change:'+185%',positive:false},
        insight:'Аномальне зростання з ₴16,800 до ₴48,000 за 2 дні. Ймовірна причина: непотрібний авто-скейлінг або помилка конфігурації. Перевірте CloudWatch.',
        chart:[16800,16800,16800,16800,16800,32000,48000,48000],
        chartLabels:['Пн','Вт','Ср','Чт','28 кві','29 кві','1 тра','2 тра'],
        items:[
          {id:'aws1',label:'AWS — аномалія (1–2 тра)', value:48000,change:+185.0,date:'1–2 тра 2026',drillable:false,flag:'crit'},
          {id:'aws2',label:'AWS — звичний платіж (кві)',value:16800,change:0,date:'28 кві 2026',drillable:false},
        ],
      },
    },
  },

  cashflow: {
    title:'Кеш Флоу', icon:'~', color:'#1C1A16',
    root:{
      summary:{value:'+₴662K',change:'+8.1%',positive:true},
      insight:'Кеш позиція здорова. Runway 7.3 місяці. Якщо оптимізувати SaaS витрати (₴14,280/міс), runway зросте до 8.5 місяців. Плануйте раунд фінансування до Q4.',
      chart:[300,352,336,418,388,464,492,456,542,708,544,662],
      chartLabels:['чер','лип','сер','вер','жов','лис','гру','січ','лют','бер','кві','тра'],
      items:[
        {id:'jan',label:'Січень 2026',   value:300000,change:+12.5},
        {id:'feb',label:'Лютий 2026',    value:622000,change:+107.3},
        {id:'mar',label:'Березень 2026', value:812000,change:+30.6},
        {id:'apr',label:'Квітень 2026',  value:544000,change:-33.0},
        {id:'may',label:'Травень 2026',  value:662000,change:+21.7},
      ],
    },
    month:{
      may:{
        summary:{value:'+₴662K',change:'+21.7%',positive:true},
        insight:'Позитивний кеш флоу всі 4 тижні. Найкращий тиждень 3 (₴260K нетто) завдяки трьом великим надходженням.',
        chart:[108,180,260,114],
        chartLabels:['Тиж 1','Тиж 2','Тиж 3','Тиж 4'],
        items:[
          {id:'cfw1',label:'Тиждень 1 — нетто',value:108000,change:0},
          {id:'cfw2',label:'Тиждень 2 — нетто',value:180000,change:0},
          {id:'cfw3',label:'Тиждень 3 — нетто',value:260000,change:0},
          {id:'cfw4',label:'Тиждень 4 — нетто',value:114000,change:0},
        ],
      },
      apr:{
        summary:{value:'+₴544K',change:'-33%',positive:false},
        insight:'Квітень показав спад — AWS аномалія (+₴31,200 зайвих витрат) і відстрочка платежу від Gamma LLC.',
        chart:[180,220,96,48],
        chartLabels:['Тиж 1','Тиж 2','Тиж 3','Тиж 4'],
        items:[
          {id:'cfw1',label:'Тиждень 1 — нетто',value:180000,change:0},
          {id:'cfw2',label:'Тиждень 2 — нетто',value:220000,change:0},
          {id:'cfw3',label:'Тиждень 3 — нетто',value:96000, change:0},
          {id:'cfw4',label:'Тиждень 4 — нетто',value:48000, change:0},
        ],
      },
    },
  },

  profit: {
    title:'Чистий прибуток', icon:'=', color:'#1C1A16',
    root:{
      summary:{value:'₴662K',change:'+8.1%',positive:true},
      insight:'Маржа 66.4% — вища за ринок (58.2%). Але витрати ростуть швидше за дохід. Без оптимізації маржа знизиться до 61% за 6 місяців.',
      chart:[300,352,336,418,388,464,492,456,542,812,544,662],
      chartLabels:['чер','лип','сер','вер','жов','лис','гру','січ','лют','бер','кві','тра'],
      items:[
        {id:'jan',label:'Січень 2026',   value:492000,change:+5.2},
        {id:'feb',label:'Лютий 2026',    value:588000,change:+19.5},
        {id:'mar',label:'Березень 2026', value:768000,change:+30.6},
        {id:'apr',label:'Квітень 2026',  value:532000,change:-30.7},
        {id:'may',label:'Травень 2026',  value:662000,change:+24.4},
      ],
    },
  },

  balance: {
    title:'Баланс рахунку', icon:'$', color:'#8C5808',
    root:{
      summary:{value:'₴2.45M',change:'Стабільно',positive:true},
      insight:'Баланс стабільний. Runway 7.3 місяці при поточному burn rate ₴11K/день. Рекомендований мінімум — 3 місяці. Плануйте поповнення до кінця Q3.',
      chart:[2100,2180,2050,2240,2300,2520,2440,2450],
      chartLabels:['жов','лис','гру','січ','лют','бер','кві','тра'],
      items:[
        {id:'main',   label:'Основний рахунок (Монобанк)',value:1820000,change:0},
        {id:'reserve',label:'Резервний рахунок',          value:450000, change:0},
        {id:'payroll',label:'Рахунок зарплат',            value:140000, change:0},
        {id:'tax',    label:'Податковий резерв',          value:40000,  change:0},
      ],
    },
  },
};

// ── Drill-down Navigation Map ──
// Defines what level to go to when clicking an item
const DRILL_NAV = {
  revenue: {
    root:     { next:'month', labelKey:'label' },
    month:    { next:'week',  labelKey:'label' },
    week:     { next:null },
  },
  expenses: {
    root:     { next:'category', labelKey:'label' },
    category: { next:'merchant', labelKey:'label' },
    merchant: { next:null },
  },
  cashflow: {
    root:     { next:'month', labelKey:'label' },
    month:    { next:null },
  },
  profit:  { root:{ next:null } },
  balance: { root:{ next:null } },
};

// ── Drill State ──
const drillState = {
  stack: [], // [{type, level, id, label}]
};

function openDrill(type) {
  const d = DRILL_DATA[type];
  if (!d) return;
  drillState.stack = [{ type, level:'root', id:null, label:d.title }];
  _renderDrillPanel();
  $('drillPanel')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDrill() {
  $('drillPanel')?.classList.remove('open');
  document.body.style.overflow = '';
  // Destroy drill chart to free memory
  if (state.charts['drill']) { state.charts['drill'].destroy(); delete state.charts['drill']; }
}

function _drillInto(type, level, id, label) {
  drillState.stack.push({ type, level, id, label });
  _renderDrillPanel();
}

function _drillBackTo(index) {
  drillState.stack = drillState.stack.slice(0, index + 1);
  _renderDrillPanel();
}

function _renderDrillPanel() {
  _renderBreadcrumbs();
  _renderDrillBody();
}

function _renderBreadcrumbs() {
  const el = $('drillBreadcrumbs');
  if (!el) return;
  el.innerHTML = '';
  drillState.stack.forEach((item, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'dbc-sep'; sep.textContent = '›';
      el.appendChild(sep);
    }
    const bc = document.createElement('span');
    bc.className = 'dbc-item' + (i === drillState.stack.length - 1 ? ' dbc-active' : '');
    bc.textContent = item.label;
    if (i < drillState.stack.length - 1) {
      bc.addEventListener('click', () => _drillBackTo(i));
    }
    el.appendChild(bc);
  });
}

function _renderDrillBody() {
  const body = $('drillBody');
  if (!body) return;

  // Show skeleton loading
  body.innerHTML = `
    <div class="sk-block" style="height:120px;margin-bottom:14px;"></div>
    <div class="sk-block" style="height:70px;margin-bottom:12px;"></div>
    <div class="sk-block" style="height:100px;margin-bottom:8px;"></div>
    <div class="sk-block" style="height:48px;margin-bottom:4px;"></div>
    <div class="sk-block" style="height:48px;margin-bottom:4px;"></div>
    <div class="sk-block" style="height:48px;"></div>`;

  setTimeout(() => {
    const cur = drillState.stack[drillState.stack.length - 1];
    if (!cur) return;
    const { type, level, id } = cur;
    const typeData = DRILL_DATA[type];
    if (!typeData) return;

    let levelData;
    if (level === 'root') {
      levelData = typeData.root;
    } else if (typeData[level] && id && typeData[level][id]) {
      levelData = typeData[level][id];
    }

    if (!levelData) {
      body.innerHTML = '<div class="drill-empty">Немає даних для цього рівня</div>';
      return;
    }

    body.innerHTML = _buildDrillHTML(type, level, levelData, typeData);

    // Attach item click handlers
    body.querySelectorAll('.drill-item[data-next]').forEach(itemEl => {
      itemEl.addEventListener('click', () => {
        _drillInto(
          itemEl.dataset.type,
          itemEl.dataset.next,
          itemEl.dataset.id,
          itemEl.dataset.label
        );
      });
    });

    // Render inline chart
    const canvas = $('drillInlineChart');
    if (canvas && levelData.chart) {
      _renderDrillChart(levelData.chart, levelData.chartLabels, typeData.color);
    }
  }, 280);
}

function _buildDrillHTML(type, level, levelData, typeData) {
  const { summary, insight, items, chart, chartLabels } = levelData;
  const nav = DRILL_NAV[type]?.[level];
  let html = '';

  // Summary
  if (summary) {
    const cClass = summary.positive ? 'pos' : 'neg';
    html += `<div class="drill-summary" style="background:${typeData.color};">
      <div class="drill-sum-label">${esc(typeData.title)}</div>
      <div class="drill-sum-value">${esc(summary.value)}</div>
      ${summary.change ? `<div class="drill-sum-change ${cClass}">${esc(summary.change)} vs попередній</div>` : ''}
    </div>`;
  }

  // Insight
  if (insight) {
    html += `<div class="drill-insight"><span class="drill-insight-tag">AI INSIGHTS</span>${esc(insight)}</div>`;
  }

  // Chart
  if (chart) {
    html += `<div class="drill-chart-wrap">
      <div class="drill-chart-label">Динаміка</div>
      <canvas id="drillInlineChart" height="72"></canvas>
    </div>`;
  }

  // Items
  if (items && items.length) {
    html += `<div class="drill-section-label">Розбивка</div>`;
    items.forEach(item => {
      const canDrill = nav?.next && !item.drillable === false &&
        (DRILL_DATA[type]?.[nav.next]?.[item.id] !== undefined || item.drillable !== false);
      const hasNextData = nav?.next && DRILL_DATA[type]?.[nav.next]?.[item.id];
      const drillable = hasNextData;
      const val = item.value != null ? '₴' + item.value.toLocaleString('uk-UA') : '';
      const changeStr = item.change ? (item.change > 0 ? `+${item.change.toFixed(1)}%` : `${item.change.toFixed(1)}%`) : '';
      const isNeg = item.change < 0;
      const changeIsGood = type === 'expenses' ? isNeg : !isNeg;
      const changeCls = item.change === 0 ? 'nt' : (changeIsGood ? 'pos' : 'neg');
      const flag = item.flag ? `<span class="drill-badge drill-badge-${item.flag}">${item.flag==='crit'?'Критично':'Увага'}</span> ` : '';

      html += `<div class="drill-item${drillable?' drill-item-has-drill':' drill-item-leaf'}"
        ${drillable ? `data-next="${esc(nav.next)}" data-type="${esc(type)}" data-id="${esc(item.id)}" data-label="${esc(item.label||item.name||'')}"` : ''}>
        <div class="drill-item-l">
          <div class="drill-item-name">${flag}${esc(item.label||item.name||'')}</div>
          ${item.date ? `<div class="drill-item-meta">${esc(item.date)}</div>` : ''}
        </div>
        <div class="drill-item-r">
          ${val ? `<div class="drill-item-val">${val}</div>` : ''}
          ${changeStr ? `<div class="drill-item-chg ${changeCls}">${changeStr}</div>` : ''}
        </div>
        ${drillable ? '<span class="drill-arr">›</span>' : ''}
      </div>`;
    });
  }

  return html;
}

const colorHex = c => ({'var(--green)':'#2A6E46','var(--red)':'#B83228','var(--amber)':'#8C5808','var(--ink)':'#1C1A16'}[c] || c || '#1C1A16');

function _renderDrillChart(data, labels, color) {
  const canvas = $('drillInlineChart');
  if (!canvas) return;
  if (state.charts['drill']) { state.charts['drill'].destroy(); delete state.charts['drill']; }
  const hex = colorHex(color);
  state.charts['drill'] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels || data.map((_,i) => String(i+1)),
      datasets: [{
        data,
        backgroundColor: hex + '33',
        borderColor: hex,
        borderWidth: 2,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend:{ display:false } },
      scales: {
        x: { ticks:{ color:TC, font:{ size:9 } }, grid:{ display:false } },
        y: { ticks:{ color:TC, font:{ size:9 }, callback: v => v >= 1000 ? '₴'+Math.round(v/1000)+'K' : v }, grid:{ color:GC } }
      }
    }
  });
}

// ── Sparkline initializer ──
function initSparklines() {
  const map = [
    { drill:'revenue',  positive:true  },
    { drill:'expenses', positive:false },
    { drill:'profit',   positive:true  },
    { drill:'balance',  positive:true  },
    { drill:'burn',     positive:false },
  ];
  const cards = document.querySelectorAll('#pg-overview .kpis > .kpi');
  cards.forEach((card, i) => {
    const m = map[i];
    if (!m) return;
    card.dataset.drill = m.drill;
    card.classList.add('kpi-clickable');

    const data = SPARKLINE_DATA[m.drill];
    const kpiD = card.querySelector('.kpi-d');
    if (kpiD && data) {
      const wrap = document.createElement('div');
      wrap.className = 'kpi-sparkline';
      wrap.innerHTML = mkSparklineSVG(data, 80, 26, m.positive);
      card.insertBefore(wrap, kpiD);
    }
    const hint = document.createElement('div');
    hint.className = 'kpi-drill-hint';
    hint.textContent = 'Деталі →';
    card.appendChild(hint);

    card.addEventListener('click', () => openDrill(m.drill));
  });
}

// ── Period Filter ──
const PERIOD_SCALES = {
  '7Д':  { rev:0.232, exp:0.241, revChg:'+9.1%',  expChg:'+14.2%', profChg:'+6.3%' },
  '30Д': { rev:1.000, exp:1.000, revChg:'+12.4%', expChg:'+18.2%', profChg:'+8.1%' },
  '90Д': { rev:2.890, exp:2.920, revChg:'+24.1%', expChg:'+31.4%', profChg:'+18.4%' },
  '1Р':  { rev:9.850, exp:9.200, revChg:'+18.6%', expChg:'+22.1%', profChg:'+15.2%' },
};

function applyPeriodFilter(periodLabel) {
  const scale = PERIOD_SCALES[periodLabel] || PERIOD_SCALES['30Д'];
  const rev = Math.round(996000 * scale.rev);
  const exp = Math.round(334000 * scale.exp);
  const prf = rev - exp;
  const fmtK = v => v >= 1000000 ? '₴' + (v/1000000).toFixed(2)+'M' : '₴'+Math.round(v/1000)+'K';

  const cards = document.querySelectorAll('#pg-overview .kpis > .kpi');
  const fadeUpdate = (card, newVal, newChg, chgClass) => {
    const vEl = card.querySelector('.kpi-v');
    const dEl = card.querySelector('.kpi-d');
    if (!vEl) return;
    vEl.style.transition = 'opacity .18s';
    vEl.style.opacity = '0';
    if (dEl) { dEl.style.transition = 'opacity .18s'; dEl.style.opacity = '0'; }
    setTimeout(() => {
      vEl.textContent = newVal;
      vEl.style.opacity = '1';
      if (dEl && newChg) {
        dEl.textContent = newChg;
        dEl.className = 'kpi-d ' + chgClass;
        dEl.style.opacity = '1';
      }
    }, 200);
  };

  if (cards[0]) fadeUpdate(cards[0], fmtK(rev), scale.revChg+' vs попередній', 'up');
  if (cards[1]) fadeUpdate(cards[1], fmtK(exp), scale.expChg+' ростуть швидше', 'dn');
  if (cards[2]) fadeUpdate(cards[2], fmtK(prf), scale.profChg, prf > 0 ? 'up' : 'dn');
}

// ── Init drill system ──
function initDrillSystem() {
  // Inject panel HTML if not present
  if (!$('drillPanel')) {
    const el = document.createElement('div');
    el.id = 'drillPanel';
    el.className = 'drill-panel';
    el.setAttribute('role','dialog');
    el.setAttribute('aria-modal','true');
    el.innerHTML = `
      <div id="drillBackdrop" class="drill-backdrop"></div>
      <div class="drill-sheet">
        <div class="drill-header">
          <nav class="drill-breadcrumbs" id="drillBreadcrumbs" aria-label="Навігація"></nav>
          <button class="drill-close" id="drillClose" aria-label="Закрити панель">×</button>
        </div>
        <div class="drill-body" id="drillBody"></div>
      </div>`;
    document.body.appendChild(el);
  }

  $('drillBackdrop')?.addEventListener('click', closeDrill);
  $('drillClose')?.addEventListener('click', closeDrill);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('drillPanel')?.classList.contains('open')) closeDrill();
  });

  // Hook period tabs into filter system
  document.querySelector('.period-tabs')?.addEventListener('click', e => {
    const tab = e.target.closest('.ptab');
    if (tab) applyPeriodFilter(tab.textContent.trim());
  });
}

// Second DOMContentLoaded — safe to add multiple listeners
document.addEventListener('DOMContentLoaded', () => {
  initSparklines();
  initDrillSystem();
});

// ══════════════════════════════════════════════
// FINANCIAL BRAIN — CFO Score + Smart Runway
// ══════════════════════════════════════════════

const CFO_SCORE = {
  total: 74, prev: 70,
  label: 'Добре',
  sublabel: 'Є зони для покращення. Потенціал зростання до 91/100',

  dimensions: [
    { id:'cash',   label:'Cash Health',            score:78, color:'green', w:.18,
      insight:'7.3 міс. runway при поточному burn. Норма ≥12 міс.',       trend:'+3' },
    { id:'burn',   label:'Burn Stability',          score:62, color:'amber', w:.15,
      insight:'Витрати ростуть +18.2%, дохід лише +12.4% — розрив 5.8%', trend:'-5' },
    { id:'mrr',    label:'Revenue Predictability',  score:84, color:'green', w:.18,
      insight:'83% загального доходу — MRR. Стабільна передбачувана база', trend:'+2' },
    { id:'saas',   label:'SaaS Efficiency',         score:54, color:'red',   w:.10,
      insight:'₴14,280/міс марнотратство виявлено — 6 невикористаних ліцензій', trend:'-8' },
    { id:'fraud',  label:'Fraud Risk',              score:91, color:'green', w:.10,
      insight:'2 аномалії за 30 днів — низький ризик, контрольовано',     trend:'+1' },
    { id:'dep',    label:'Revenue Dependency',      score:67, color:'amber', w:.14,
      insight:'22% revenue від Acme Corp — висока концентрація на 1 клієнта', trend:'0' },
    { id:'growth', label:'Growth Momentum',         score:79, color:'green', w:.15,
      insight:'+12.4% MoM, NRR 108%. Позитивна траєкторія',               trend:'+4' },
  ],

  actions: [
    { text:'Скасувати Zoom (дублює Teams)',                  impact:'+4', diff:'easy',   saving:'₴3,560/міс' },
    { text:'Знизити Figma до 5 місць (8→5 seats)',          impact:'+3', diff:'easy',   saving:'₴1,680/міс' },
    { text:'Tableau → Looker Studio (безкоштовно)',          impact:'+5', diff:'easy',   saving:'₴5,840/міс' },
    { text:'AWS Reserved Instances замість On-Demand',       impact:'+6', diff:'medium', saving:'₴6,720/міс' },
    { text:'Переглянути бюджет маркетингу (ROI нижчий норми)',impact:'+3', diff:'medium', saving:'₴8,000/міс' },
  ],

  alerts: [
    { type:'critical', icon:'!', text:'Beta Solutions затримує оплату вже 3 цикли підряд — ₴185K/міс під ризиком' },
    { type:'warning',  icon:'↑', text:'SaaS витрати на 37% вище середнього для SaaS-команди 12 осіб' },
    { type:'warning',  icon:'↑', text:'AWS зростання +185% за місяць — аномальний spike виявлено' },
    { type:'info',     icon:'→', text:'Виконавши всі дії в таблиці нижче — Score зросте до 91/100' },
  ],
};

const RUNWAY_DATA = {
  cash: 2_450_000,
  revenue: 996_000,
  costs: 950_000,
  scenarios: [
    { label:'Поточний тренд',      revM:1.00, expM:1.00, desc:'Базовий сценарій' },
    { label:'Скорочення SaaS −15%',revM:1.00, expM:0.85, desc:'Оптимізація підписок' },
    { label:'Hiring +20%',         revM:1.10, expM:1.18, desc:'Ріст команди 12→14' },
    { label:'Дохід −30%',          revM:0.70, expM:1.00, desc:'Втрата ключових клієнтів' },
    { label:'Кризовий −50%',       revM:0.50, expM:1.00, desc:'Тяжкий ринок' },
    { label:'Нульовий дохід',      revM:0.00, expM:1.00, desc:'Стрес-тест: виживання' },
  ],
};

function _runwayMonths(revM, expM) {
  const net = RUNWAY_DATA.revenue * revM - RUNWAY_DATA.costs * expM;
  if (net >= 0) return Infinity;
  return RUNWAY_DATA.cash / (-net);
}

function _fmtRunway(months) {
  if (!isFinite(months)) return '∞';
  if (months >= 24) return Math.round(months) + ' міс.';
  if (months >= 1)  return months.toFixed(1) + ' міс.';
  return Math.round(months * 30) + ' дн.';
}

function _runwayColor(months) {
  if (!isFinite(months) || months >= 12) return 'green';
  if (months >= 6) return 'amber';
  return 'red';
}

// ── Render CFO Score page ─────────────────────────────────
function renderCFOScore() {
  const s = CFO_SCORE;
  const arcEl = document.getElementById('scoreArc');
  const numEl = document.getElementById('scoreNumber');
  const labelEl = document.getElementById('scoreLabel');
  const subEl   = document.getElementById('scoreSub');
  const prevEl  = document.getElementById('scoreVsPrev');
  const dimsEl  = document.getElementById('scoreDimensions');
  const alertsEl = document.getElementById('scoreAlerts');
  const actEl   = document.getElementById('scoreActionsBody');
  const tgtEl   = document.getElementById('scoreActionsTarget');

  if (!numEl) return; // page not in DOM yet

  // Animate ring
  if (arcEl) {
    const circum = 427;
    const offset = circum - (s.total / 100) * circum;
    const col = s.total >= 80 ? '#2A6E46' : s.total >= 60 ? '#C4882E' : '#B83228';
    arcEl.setAttribute('stroke-dashoffset', offset);
    arcEl.setAttribute('stroke', col);
  }

  if (numEl) numEl.textContent = s.total;
  if (labelEl) {
    const col = s.total >= 80 ? 'var(--green)' : s.total >= 60 ? 'var(--amber)' : 'var(--red)';
    labelEl.style.color = col;
    labelEl.textContent = s.label;
  }
  if (subEl)  subEl.textContent = s.sublabel;
  if (prevEl) {
    const diff = s.total - s.prev;
    const sign = diff > 0 ? '+' : '';
    prevEl.textContent = `${sign}${diff} за місяць`;
    prevEl.style.background = diff > 0 ? 'rgba(42,110,70,.1)' : 'rgba(184,50,40,.1)';
    prevEl.style.color = diff > 0 ? 'var(--green)' : 'var(--red)';
  }

  // Dimensions
  if (dimsEl) {
    const COLOR = { green:'var(--green)', amber:'var(--amber)', red:'var(--red)' };
    const BORDER = { green:'var(--green)', amber:'var(--amber)', red:'var(--red)' };
    dimsEl.innerHTML = '';
    s.dimensions.forEach(d => {
      const col = COLOR[d.color];
      const trendSign = d.trend.startsWith('+') ? '+' : (d.trend === '0' ? '=' : '');
      const trendColor = d.trend.startsWith('+') ? 'var(--green)' : (d.trend === '0' ? 'var(--warm)' : 'var(--red)');
      const div = document.createElement('div');
      div.className = 'card';
      div.style.cssText = `border-left:3px solid ${col};padding:12px 16px;`;
      div.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;">
          <div style="font-size:12.5px;font-weight:700;color:var(--ink);">${esc(d.label)}</div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:11px;font-weight:600;color:${trendColor};">${trendSign}${esc(d.trend)}</span>
            <span style="font-size:19px;font-weight:800;font-family:'DM Mono',monospace;color:${col};">${d.score}</span>
          </div>
        </div>
        <div style="height:4px;background:var(--cream3);border-radius:3px;overflow:hidden;margin-bottom:6px;">
          <div style="width:${d.score}%;height:100%;background:${col};border-radius:3px;transition:width 1s ease;"></div>
        </div>
        <div style="font-size:11px;color:var(--warm);">${esc(d.insight)}</div>`;
      dimsEl.appendChild(div);
    });
  }

  // Alerts
  if (alertsEl) {
    const TYPE = {
      critical: { border:'var(--red)',  bg:'var(--red-bg)',    text:'КРИТИЧНО', tc:'var(--red)' },
      warning:  { border:'var(--amber)',bg:'var(--amber-bg)',  text:'УВАГА',    tc:'var(--amber)' },
      info:     { border:'var(--blue)', bg:'var(--blue-bg)',   text:'INFO',     tc:'var(--blue)' },
    };
    alertsEl.innerHTML = '';
    s.alerts.forEach(a => {
      const t = TYPE[a.type] || TYPE.info;
      const div = document.createElement('div');
      div.className = 'card';
      div.style.cssText = `border-left:3px solid ${t.border};display:flex;align-items:center;gap:12px;padding:12px 16px;`;
      div.innerHTML = `
        <div style="width:32px;height:32px;border-radius:8px;background:${t.bg};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:${t.tc};flex-shrink:0;">${esc(a.icon)}</div>
        <div style="flex:1;">
          <span style="font-size:9.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:${t.tc};margin-right:8px;">${t.text}</span>
          <span style="font-size:12.5px;color:var(--charcoal);">${esc(a.text)}</span>
        </div>`;
      alertsEl.appendChild(div);
    });
  }

  // Actions table
  if (actEl) {
    const DIFF = { easy:'c-g', medium:'c-a', hard:'c-r' };
    const DIFF_LBL = { easy:'Легко', medium:'Середньо', hard:'Складно' };
    actEl.innerHTML = '';
    s.actions.forEach(a => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:600;">${esc(a.text)}</td>
        <td><span class="chip c-g">${esc(a.impact)} бали</span></td>
        <td><span class="chip ${DIFF[a.diff]||'c-n'}">${DIFF_LBL[a.diff]||a.diff}</span></td>
        <td class="pos">${esc(a.saving)}</td>
        <td><button onclick="this.textContent='✓ Виконано';this.disabled=true;this.style.background='var(--green-bg)';this.style.color='var(--green)';this.style.border='1px solid #B8DFC5';" style="font-size:11px;padding:4px 12px;border-radius:5px;background:var(--ink);color:var(--cream);border:none;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .2s;">Зробити</button></td>`;
      actEl.appendChild(tr);
    });
  }
  if (tgtEl) {
    const totalSaving = s.actions.reduce((sum, a) => {
      const m = a.saving.match(/[\d,]+/);
      return sum + (m ? parseInt(m[0].replace(/,/g,'')) : 0);
    }, 0);
    tgtEl.textContent = `Загальна потенційна економія: ₴${(totalSaving/1000).toFixed(0)}K/міс`;
  }
}

// ── Render Smart Runway Engine ────────────────────────────
function renderRunwayEngine() {
  const el = document.getElementById('runwayEngine');
  if (!el) return;

  const rows = RUNWAY_DATA.scenarios.map(sc => {
    const m = _runwayMonths(sc.revM, sc.expM);
    const col = _runwayColor(m);
    const fmt = _fmtRunway(m);
    const net = Math.round(RUNWAY_DATA.revenue * sc.revM - RUNWAY_DATA.costs * sc.expM);
    const netStr = net >= 0 ? `+₴${(net/1000).toFixed(0)}K` : `−₴${(Math.abs(net)/1000).toFixed(0)}K`;
    const netCol = net >= 0 ? 'var(--green)' : 'var(--red)';
    const bar = isFinite(m) ? Math.min(100, Math.round(m / 24 * 100)) : 100;
    const barCol = col === 'green' ? 'var(--green)' : col === 'amber' ? 'var(--amber)' : 'var(--red)';
    return `<tr>
      <td style="font-weight:600;">${esc(sc.label)}</td>
      <td style="font-size:11px;color:var(--warm);">${esc(sc.desc)}</td>
      <td><div style="display:flex;align-items:center;gap:8px;">
        <div style="flex:1;height:5px;background:var(--cream3);border-radius:3px;min-width:48px;">
          <div style="width:${bar}%;height:100%;background:${barCol};border-radius:3px;"></div></div>
        <span style="font-family:'DM Mono',monospace;font-size:13px;font-weight:700;color:${barCol};min-width:56px;text-align:right;">${fmt}</span>
      </div></td>
      <td style="font-family:'DM Mono',monospace;font-size:12px;font-weight:600;color:${netCol};">${netStr}/міс</td>
    </tr>`;
  }).join('');

  // Critical date — when would zero-revenue runway hit
  const zeroM = _runwayMonths(0, 1);
  const critDays = Math.round(zeroM * 30);
  const baseM = _runwayMonths(1, 1);

  el.innerHTML = `
    <div class="card" style="border-top:3px solid var(--ink);margin-bottom:14px;">
      <div class="card-hd">
        <div>
          <div class="card-t">Smart Runway Engine</div>
          <div class="card-s">Сценарний аналіз · Що буде якщо…</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
        <div style="background:var(--green-bg);border:1px solid #B8DFC5;border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--green);margin-bottom:6px;">Поточна траєкторія</div>
          <div style="font-family:'DM Serif Display',serif;font-size:28px;color:var(--green);">${isFinite(baseM) ? baseM.toFixed(1)+' міс.' : '∞'}</div>
          <div style="font-size:11px;color:var(--green);margin-top:3px;">Прибутково</div>
        </div>
        <div style="background:var(--red-bg);border:1px solid #F0C4C0;border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--red);margin-bottom:6px;">Нульовий дохід</div>
          <div style="font-family:'DM Serif Display',serif;font-size:28px;color:var(--red);">${critDays} дн.</div>
          <div style="font-size:11px;color:var(--red);margin-top:3px;">До кінця грошей</div>
        </div>
        <div style="background:var(--amber-bg);border:1px solid #F0DDB8;border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--amber);margin-bottom:6px;">Дохід −30%</div>
          <div style="font-family:'DM Serif Display',serif;font-size:28px;color:var(--amber);">${_fmtRunway(_runwayMonths(0.7,1))}</div>
          <div style="font-size:11px;color:var(--amber);margin-top:3px;">Якщо втратите клієнтів</div>
        </div>
      </div>
      <div class="tbl">
        <table>
          <thead><tr><th>Сценарій</th><th>Умова</th><th>Runway</th><th>Net/міс</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="margin-top:12px;padding:12px 14px;background:var(--cream);border-radius:9px;border-left:3px solid var(--amber);">
        <span style="font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--amber);margin-right:8px;">ВИСНОВОК</span>
        <span style="font-size:12.5px;color:var(--charcoal);">
          При поточному стані компанія прибуткова (+₴${((RUNWAY_DATA.revenue - RUNWAY_DATA.costs)/1000).toFixed(0)}K/міс).
          Критична точка: втрата >54% доходу одразу.
          Рекомендація: розподілити ризик між клієнтами та скоротити SaaS на 15%.
        </span>
      </div>
    </div>`;
}

// Init calls on nav to score/whatif pages
document.addEventListener('DOMContentLoaded', () => {
  // Render immediately if page is already shown
  renderCFOScore();
  renderRunwayEngine();
});

// Re-render when navigating to these pages
const _origNav = typeof nav === 'function' ? nav : null;
// Hook nav to re-render on page switch
document.addEventListener('click', e => {
  const sbItem = e.target.closest('.sb-item[data-page]');
  if (!sbItem) return;
  const p = sbItem.dataset.page;
  if (p === 'score')  setTimeout(renderCFOScore,  50);
  if (p === 'whatif') setTimeout(renderRunwayEngine, 50);
});

// ══════════════════════════════════════════════
// CHUNK 2 — AI Spend Intelligence + Revenue Risk
// ══════════════════════════════════════════════

const SPEND_INTEL = {
  teamSize: 12,
  totalSpend: 93_500,
  marketPerPerson: 7_200, // середній SaaS spend/особу для IT 12 осіб

  tools: [
    { name:'Figma Pro',       cat:'Дизайн',    cost:4_480, seats:8,  active:5,  market:3_500, issue:'unused',    unusedN:3, savings:1_680, alt:null,                      icon:'🎨' },
    { name:'Zoom Business',   cat:'Відео',     cost:3_560, seats:12, active:9,  market:2_400, issue:'duplicate', unusedN:0, savings:3_560, alt:'Microsoft Teams',         icon:'📹' },
    { name:'Slack Business+', cat:'Месенджер', cost:7_500, seats:12, active:11, market:6_800, issue:'ok',        unusedN:1, savings:0,     alt:null,                      icon:'💬' },
    { name:'AWS Cloud',       cat:'Хмара',     cost:16_800,seats:null,active:null,market:12_000,issue:'overpriced',unusedN:0,savings:4_800,alt:'Reserved Instances −29%', icon:'☁️' },
    { name:'Tableau',         cat:'Аналітика', cost:5_840, seats:5,  active:2,  market:0,     issue:'free_alt',  unusedN:3, savings:5_840, alt:'Looker Studio (безкошт.)',icon:'📊' },
    { name:'Adobe CC',        cat:'Дизайн',    cost:12_800,seats:15, active:10, market:10_500, issue:'unused',   unusedN:5, savings:4_267, alt:null,                      icon:'🖼️' },
    { name:'Microsoft Teams', cat:'Відео',     cost:3_680, seats:12, active:8,  market:3_200, issue:'ok',        unusedN:4, savings:0,     alt:null,                      icon:'📹' },
    { name:'Miro',            cat:'Дошка',     cost:3_520, seats:8,  active:4,  market:1_500, issue:'unused',    unusedN:4, savings:1_760, alt:'FigJam (безкошт.)',       icon:'📌' },
    { name:'Notion Business', cat:'Знання',    cost:2_880, seats:12, active:10, market:2_500, issue:'ok',        unusedN:2, savings:0,     alt:null,                      icon:'📝' },
  ],
};

const REVENUE_RISK = {
  total: 996_000,
  clients: [
    { name:'Acme Corp',      ini:'AC', mrr:220_000, share:22.1, days:2,   late:0, trend:'stable',   risk:'low',    col:'green' },
    { name:'Beta Solutions', ini:'BS', mrr:185_000, share:18.6, days:45,  late:3, trend:'late',     risk:'high',   col:'red'   },
    { name:'Gamma Tech',     ini:'GT', mrr:156_000, share:15.7, days:15,  late:0, trend:'stable',   risk:'low',    col:'green' },
    { name:'Delta Finance',  ini:'DF', mrr:128_000, share:12.9, days:8,   late:0, trend:'growing',  risk:'low',    col:'green' },
    { name:'Epsilon Ltd',    ini:'EL', mrr:98_000,  share:9.8,  days:30,  late:1, trend:'declining',risk:'medium', col:'amber' },
    { name:'Zeta Group',     ini:'ZG', mrr:68_000,  share:6.8,  days:20,  late:0, trend:'stable',   risk:'low',    col:'green' },
    { name:'Інші ×8',        ini:'··', mrr:141_000, share:14.1, days:null,late:0, trend:'stable',   risk:'low',    col:'green' },
  ],
  insights: [
    { type:'critical', text:'Beta Solutions не платить 45 днів (3-й цикл підряд) — ₴185K/міс під ризиком' },
    { type:'critical', text:'22.1% доходу від одного клієнта (Acme Corp) — критична залежність' },
    { type:'warning',  text:'Epsilon Ltd спадний тренд 2 міс. підряд — ймовірний churn' },
    { type:'info',     text:'Delta Finance росте +18% MoM — можливість для upsell / розширення' },
  ],
};

// ── Spend Intelligence renderer ────────────────────────
function renderSpendIntel() {
  const el = document.getElementById('spendIntelPanel');
  if (!el) return;

  const si = SPEND_INTEL;
  const yourPP = Math.round(si.totalSpend / si.teamSize);
  const pct    = Math.round((yourPP - si.marketPerPerson) / si.marketPerPerson * 100);
  const totalWaste = si.tools.reduce((s, t) => s + t.savings, 0);
  const issueCount = si.tools.filter(t => t.issue !== 'ok').length;

  const ISSUE_MAP = {
    unused:    { label:'Невикор. місця', col:'var(--amber)', bg:'var(--amber-bg)' },
    duplicate: { label:'Дублікат',       col:'var(--red)',   bg:'var(--red-bg)'   },
    free_alt:  { label:'Є безкошт. альт.',col:'var(--blue)', bg:'var(--blue-bg)'  },
    overpriced:{ label:'Переплата',      col:'var(--red)',   bg:'var(--red-bg)'   },
    ok:        { label:'OK',             col:'var(--green)', bg:'var(--green-bg)' },
  };

  const rows = si.tools.map(t => {
    const im = ISSUE_MAP[t.issue] || ISSUE_MAP.ok;
    const usageBar = t.seats ? Math.round(t.active / t.seats * 100) : null;
    const usageHtml = usageBar !== null
      ? `<div style="display:flex;align-items:center;gap:6px;min-width:80px;">
           <div style="flex:1;height:4px;background:var(--cream3);border-radius:2px;">
             <div style="width:${usageBar}%;height:100%;background:${usageBar>=80?'var(--green)':usageBar>=50?'var(--amber)':'var(--red)'};border-radius:2px;"></div>
           </div>
           <span style="font-size:10.5px;font-family:'DM Mono',monospace;">${t.active}/${t.seats}</span>
         </div>`
      : `<span style="font-size:11px;color:var(--warm);">N/A</span>`;
    const savHtml = t.savings > 0
      ? `<span style="color:var(--green);font-weight:700;font-family:'DM Mono',monospace;">₴${(t.savings/1000).toFixed(1)}K</span>`
      : `<span style="color:var(--warm);">—</span>`;
    const altHtml = t.alt
      ? `<span style="font-size:11px;color:var(--blue);">${esc(t.alt)}</span>`
      : `<span style="color:var(--warm);font-size:11px;">—</span>`;
    return `<tr>
      <td><span style="font-size:14px;margin-right:6px;">${t.icon}</span><span style="font-weight:600;">${esc(t.name)}</span></td>
      <td style="font-family:'DM Mono',monospace;font-size:12.5px;">₴${(t.cost/1000).toFixed(1)}K</td>
      <td>${usageHtml}</td>
      <td><span style="font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:20px;background:${im.bg};color:${im.col};">${im.label}</span></td>
      <td>${savHtml}</td>
      <td>${altHtml}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="card" style="border-top:3px solid var(--ink);margin-bottom:14px;">
      <div class="card-hd"><div>
        <div class="card-t">AI Spend Intelligence</div>
        <div class="card-s">Аналіз SaaS стека відносно ринкового бенчмарку</div>
      </div></div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
        <div style="background:var(--red-bg);border:1px solid #F0C4C0;border-radius:10px;padding:14px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--red);margin-bottom:6px;">Ви переплачуєте</div>
          <div style="font-family:'DM Serif Display',serif;font-size:28px;color:var(--red);">+${pct}%</div>
          <div style="font-size:11.5px;color:var(--red);margin-top:3px;">vs ринку для ${si.teamSize} осіб</div>
        </div>
        <div style="background:var(--amber-bg);border:1px solid #F0DDB8;border-radius:10px;padding:14px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--amber);margin-bottom:6px;">Марнотратство/міс</div>
          <div style="font-family:'DM Serif Display',serif;font-size:28px;color:var(--amber);">₴${(totalWaste/1000).toFixed(0)}K</div>
          <div style="font-size:11.5px;color:var(--amber);margin-top:3px;">₴${(totalWaste*12/1000).toFixed(0)}K/рік</div>
        </div>
        <div style="background:var(--green-bg);border:1px solid #B8DFC5;border-radius:10px;padding:14px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--green);margin-bottom:6px;">Проблем знайдено</div>
          <div style="font-family:'DM Serif Display',serif;font-size:28px;color:var(--green);">${issueCount}</div>
          <div style="font-size:11.5px;color:var(--green);margin-top:3px;">з ${si.tools.length} інструментів</div>
        </div>
      </div>

      <div style="background:var(--cream);border-radius:10px;padding:12px 14px;margin-bottom:16px;border-left:3px solid var(--red);">
        <span style="font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--red);margin-right:8px;">BENCHMARK</span>
        <span style="font-size:12.5px;color:var(--charcoal);">
          Ви платите <strong>₴${yourPP.toLocaleString()}/особу/міс</strong> за SaaS.
          Середнє для IT-компаній вашого розміру — <strong>₴${si.marketPerPerson.toLocaleString()}</strong>.
          Різниця: <strong style="color:var(--red);">+₴${(yourPP-si.marketPerPerson).toLocaleString()}/особу</strong>.
        </span>
      </div>

      <div class="tbl">
        <table>
          <thead><tr><th>Інструмент</th><th>Вартість/міс</th><th>Використання</th><th>Статус</th><th>Економія</th><th>Альтернатива</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

// ── Revenue Risk renderer ──────────────────────────────
function renderRevenueRisk() {
  const el = document.getElementById('revenueRiskPanel');
  if (!el) return;

  const rr = REVENUE_RISK;
  const atRisk = rr.clients.filter(c => c.risk !== 'low').reduce((s, c) => s + c.mrr, 0);
  const late   = rr.clients.filter(c => c.late > 0).length;
  const topShare = Math.max(...rr.clients.map(c => c.share));

  const RISK_MAP = {
    low:    { label:'Низький',   col:'var(--green)', bg:'var(--green-bg)' },
    medium: { label:'Середній',  col:'var(--amber)', bg:'var(--amber-bg)' },
    high:   { label:'Високий',   col:'var(--red)',   bg:'var(--red-bg)'   },
  };
  const TREND_MAP = {
    stable:   '→', growing: '↑', declining: '↓', late: '⚠',
  };

  // Concentration bar
  const conc = rr.clients.map(c => {
    const w = c.share;
    const colMap = { green:'var(--green)', amber:'var(--amber)', red:'var(--red)' };
    return `<div title="${esc(c.name)} — ${c.share}%" style="width:${w}%;height:100%;background:${colMap[c.col]||'var(--blue)'};position:relative;min-width:2px;">
      <div style="position:absolute;bottom:calc(100% + 4px);left:50%;transform:translateX(-50%);font-size:9px;font-weight:700;white-space:nowrap;color:${colMap[c.col]};display:none;" class="concLabel">${c.ini}</div>
    </div>`;
  }).join('');

  const rows = rr.clients.map(c => {
    const rm = RISK_MAP[c.risk] || RISK_MAP.low;
    const daysBadge = c.days === null ? '—'
      : c.days <= 7  ? `<span style="color:var(--green);font-weight:700;">${c.days} дн.</span>`
      : c.days <= 20 ? `<span style="color:var(--amber);font-weight:700;">${c.days} дн.</span>`
      : `<span style="color:var(--red);font-weight:700;">${c.days} дн. ⚠</span>`;
    const lateBadge = c.late > 0
      ? `<span style="font-size:9px;background:var(--red-bg);color:var(--red);border-radius:20px;padding:1px 6px;font-weight:700;">${c.late}× поспіль</span>`
      : '';
    const trend = TREND_MAP[c.trend] || '→';
    const trendCol = c.trend==='growing'?'var(--green)':c.trend==='declining'||c.trend==='late'?'var(--red)':'var(--warm)';
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:28px;height:28px;border-radius:7px;background:var(--cream2);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;font-family:'DM Mono',monospace;color:var(--ink);flex-shrink:0;">${esc(c.ini)}</div>
          <div>
            <div style="font-weight:600;font-size:13px;">${esc(c.name)}</div>
            ${lateBadge}
          </div>
        </div>
      </td>
      <td style="font-family:'DM Mono',monospace;font-weight:700;">₴${(c.mrr/1000).toFixed(0)}K</td>
      <td>
        <div style="display:flex;align-items:center;gap:4px;">
          <div style="flex:1;height:4px;background:var(--cream3);border-radius:2px;min-width:40px;">
            <div style="width:${Math.min(100,c.share/topShare*100)}%;height:100%;background:var(--ink);border-radius:2px;"></div>
          </div>
          <span style="font-size:11px;font-weight:600;">${c.share}%</span>
        </div>
      </td>
      <td>${daysBadge}</td>
      <td><span style="font-size:15px;color:${trendCol};">${trend}</span></td>
      <td><span style="font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:20px;background:${rm.bg};color:${rm.col};">${rm.label}</span></td>
    </tr>`;
  }).join('');

  const alerts = rr.insights.map(a => {
    const t = {critical:{b:'var(--red)',i:'!'},warning:{b:'var(--amber)',i:'↑'},info:{b:'var(--blue)',i:'→'}}[a.type]||{b:'var(--blue)',i:'→'};
    const bg = {critical:'var(--red-bg)',warning:'var(--amber-bg)',info:'var(--blue-bg)'}[a.type]||'var(--blue-bg)';
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:${bg};border-radius:9px;border-left:3px solid ${t.b};">
      <span style="font-size:14px;font-weight:800;color:${t.b};flex-shrink:0;">${t.i}</span>
      <span style="font-size:12.5px;color:var(--charcoal);">${esc(a.text)}</span>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;margin-top:14px;">
      <div class="card" style="border-top:3px solid var(--red);">
        <div class="card-hd"><div>
          <div class="card-t">Revenue Risk Detection</div>
          <div class="card-s">Ризики відтоку, концентрації та затримок оплати</div>
        </div></div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
          <div style="background:var(--red-bg);border:1px solid #F0C4C0;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--red);margin-bottom:6px;">Під ризиком</div>
            <div style="font-family:'DM Serif Display',serif;font-size:28px;color:var(--red);">₴${(atRisk/1000).toFixed(0)}K</div>
            <div style="font-size:11px;color:var(--red);margin-top:3px;">/міс від ${rr.clients.filter(c=>c.risk!=='low').length} клієнтів</div>
          </div>
          <div style="background:var(--amber-bg);border:1px solid #F0DDB8;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--amber);margin-bottom:6px;">Затримки оплати</div>
            <div style="font-family:'DM Serif Display',serif;font-size:28px;color:var(--amber);">${late}</div>
            <div style="font-size:11px;color:var(--amber);margin-top:3px;">клієнт${late===1?'':'и'} прострочено</div>
          </div>
          <div style="background:var(--cream);border:1.5px solid var(--border);border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--warm);margin-bottom:6px;">Топ концентрація</div>
            <div style="font-family:'DM Serif Display',serif;font-size:28px;color:var(--ink);">${topShare}%</div>
            <div style="font-size:11px;color:var(--warm);margin-top:3px;">від одного клієнта</div>
          </div>
        </div>

        <!-- Concentration bar -->
        <div style="margin-bottom:16px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--warm);margin-bottom:6px;">Розподіл доходу по клієнтах</div>
          <div style="display:flex;height:18px;border-radius:9px;overflow:hidden;gap:1px;">${conc}</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">
            ${rr.clients.map(c=>{
              const colMap={green:'var(--green)',amber:'var(--amber)',red:'var(--red)'};
              return `<div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--charcoal);">
                <div style="width:8px;height:8px;border-radius:2px;background:${colMap[c.col]||'var(--blue)'};flex-shrink:0;"></div>
                ${esc(c.ini)} ${c.share}%</div>`;
            }).join('')}
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">${alerts}</div>

        <div class="tbl">
          <table>
            <thead><tr><th>Клієнт</th><th>MRR</th><th>Частка</th><th>Остання оплата</th><th>Тренд</th><th>Ризик</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

// ── Init Chunk 2 ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderSpendIntel();
  renderRevenueRisk();
});

document.addEventListener('click', e => {
  const p = e.target.closest('.sb-item[data-page]')?.dataset?.page;
  if (p === 'audit')   setTimeout(renderSpendIntel,  50);
  if (p === 'revenue') setTimeout(renderRevenueRisk, 50);
});

// ══════════════════════════════════════════════
// CHUNK 3 — AI Actions + Board Report Generator
// ══════════════════════════════════════════════

const AI_ACTIONS = [
  { id:'cancel-zoom',    icon:'🚫', cat:'SaaS',    title:'Скасувати Zoom Business',
    desc:'Дублює Microsoft Teams. Економія ₴3,560/міс → Score +4 бали',
    impact:'+4 Score · ₴3,560/міс', confirm:'Скасувати підписку Zoom Business? Зберегти ₴42,720/рік.', type:'cancel' },
  { id:'cancel-tableau', icon:'📊', cat:'SaaS',    title:'Замінити Tableau на Looker Studio',
    desc:'Looker Studio безкоштовний. Active seats: 2/5. ₴5,840/міс зекономите',
    impact:'+5 Score · ₴5,840/міс', confirm:'Перейти з Tableau на Looker Studio (Google, безкошт.)?', type:'cancel' },
  { id:'remind-beta',    icon:'📧', cat:'Revenue', title:'Нагадування Beta Solutions',
    desc:'45 днів прострочення · 3-й цикл підряд · ₴185K під ризиком',
    impact:'₴185K MRR', confirm:null, type:'email' },
  { id:'reduce-figma',   icon:'🎨', cat:'SaaS',    title:'Знизити Figma до 5 місць',
    desc:'Active seats: 5/8. Платите за 3 невикористані місця (₴1,680/міс)',
    impact:'+3 Score · ₴1,680/міс', confirm:'Знизити план Figma з 8 до 5 місць?', type:'cancel' },
  { id:'aws-reserved',   icon:'☁️', cat:'Infra',   title:'AWS Reserved Instances',
    desc:'Переключити On-Demand → Reserved 1yr. Економія 29% = ₴4,800/міс',
    impact:'+6 Score · ₴4,800/міс', confirm:'Переключити AWS на Reserved Instances? Потрібен devops доступ.', type:'delegate' },
  { id:'freeze-mkt',     icon:'❄️', cat:'Budget',  title:'Заморозити маркетинг Q2',
    desc:'Маркетинг ROI нижчий норми 2 місяці підряд. Перерозподілити бюджет',
    impact:'₴8,000/міс вивільниться', confirm:'Заморозити бюджет маркетингу до кінця Q2?', type:'freeze' },
];

const ACTION_STATE = {}; // id → 'pending' | 'loading' | 'done' | 'error'

function renderAIActions() {
  const el = document.getElementById('aiActionsCard');
  if (!el) return;

  const done  = Object.values(ACTION_STATE).filter(s => s === 'done').length;
  const total = AI_ACTIONS.length;

  const items = AI_ACTIONS.map(a => {
    const st = ACTION_STATE[a.id] || 'pending';
    const CAT_COL = { SaaS:'var(--blue)', Revenue:'var(--green)', Infra:'var(--amber)', Budget:'var(--red)' };
    const catCol  = CAT_COL[a.cat] || 'var(--warm)';

    let btnHtml;
    if (st === 'done') {
      btnHtml = `<button disabled style="padding:7px 16px;border-radius:7px;background:var(--green-bg);color:var(--green);border:1px solid #B8DFC5;font-size:12px;font-weight:700;font-family:'DM Sans',sans-serif;cursor:default;">✓ Виконано</button>`;
    } else if (st === 'loading') {
      btnHtml = `<button disabled style="padding:7px 16px;border-radius:7px;background:var(--cream2);color:var(--warm);border:1px solid var(--border);font-size:12px;font-family:'DM Sans',sans-serif;">…</button>`;
    } else {
      const label = { cancel:'Скасувати', email:'Надіслати', delegate:'Делегувати', freeze:'Заморозити' }[a.type] || 'Виконати';
      const bg    = { cancel:'var(--ink)', email:'var(--ink)', delegate:'var(--cream2)', freeze:'var(--red-bg)' }[a.type];
      const col   = { cancel:'var(--cream)', email:'var(--cream)', delegate:'var(--charcoal)', freeze:'var(--red)' }[a.type];
      const brd   = { cancel:'none', email:'none', delegate:'1.5px solid var(--border)', freeze:'1px solid #F0C4C0' }[a.type];
      btnHtml = `<button onclick="executeAction('${a.id}')" style="padding:7px 16px;border-radius:7px;background:${bg};color:${col};border:${brd};font-size:12px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap;transition:opacity .15s;">${label}</button>`;
    }

    return `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);" id="action-row-${a.id}">
      <div style="font-size:20px;flex-shrink:0;">${a.icon}</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:2px;">
          <span style="font-size:13px;font-weight:700;color:var(--ink);">${esc(a.title)}</span>
          <span style="font-size:9.5px;font-weight:800;letter-spacing:.04em;padding:1px 7px;border-radius:20px;background:var(--cream2);color:${catCol};">${esc(a.cat)}</span>
        </div>
        <div style="font-size:12px;color:var(--warm);">${esc(a.desc)}</div>
        <div style="font-size:11px;font-weight:600;color:var(--green);margin-top:2px;">${esc(a.impact)}</div>
      </div>
      <div style="flex-shrink:0;">${btnHtml}</div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="card" style="border-top:3px solid var(--ink);margin-bottom:14px;">
      <div class="card-hd">
        <div>
          <div class="card-t">AI Actions</div>
          <div class="card-s">Рекомендовані дії · ${done}/${total} виконано</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="font-size:11px;font-weight:700;color:var(--green);">
            Загальна економія: ₴${((3560+5840+1680+4800+8000)/1000).toFixed(0)}K/міс
          </div>
        </div>
      </div>
      <div style="padding:0 4px;">${items}</div>
    </div>`;
}

async function executeAction(id) {
  const action = AI_ACTIONS.find(a => a.id === id);
  if (!action) return;

  if (action.type === 'email') {
    _generateReminder(action);
    return;
  }

  if (action.confirm && !confirm(action.confirm)) return;

  ACTION_STATE[id] = 'loading';
  renderAIActions();

  await new Promise(r => setTimeout(r, 800 + Math.random() * 600));

  ACTION_STATE[id] = 'done';
  renderAIActions();

  const msgs = {
    'cancel-zoom':    'Zoom Business скасовано. Економія ₴3,560/міс зафіксована.',
    'cancel-tableau': 'Tableau скасовано. Looker Studio — безкоштовна альтернатива.',
    'reduce-figma':   'Figma понижено до 5 місць. ₴1,680/міс зекономлено.',
    'aws-reserved':   'Задачу делеговано DevOps. Очікуйте підтвердження.',
    'freeze-mkt':     'Маркетинг-бюджет заморожено до кінця Q2.',
  };
  showToast(msgs[id] || 'Виконано!', 'success');
}

async function _generateReminder(action) {
  const btn = document.querySelector(`#action-row-${action.id} button`);
  if (btn) { btn.disabled = true; btn.textContent = '…'; }

  const prompt = `Ти — CFO компанії. Напиши короткий, ввічливий але прямий email-нагадування клієнту Beta Solutions Ltd про прострочену оплату.

Деталі:
- Сума: ₴185,000 (MRR за травень 2026)
- Прострочення: 45 днів  
- Це 3-й цикл підряд
- Попереднє нагадування: 20 днів тому

Формат: Тема листа + тіло листа. Мова: українська. Тон: professional, без погроз, але чітко. Максимум 8 речень.`;

  try {
    const text = await callClaude('Ти фінансовий директор SaaS компанії.', [{ role:'user', content:prompt }], 400);
    showEmailModal(text, 'Beta Solutions Ltd');
  } catch (err) {
    showToast('AI недоступний. Перевірте API ключ.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Надіслати'; }
  }
}

function showEmailModal(text, recipient) {
  let m = document.getElementById('emailModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'emailModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;background:rgba(14,12,10,.4);backdrop-filter:blur(3px);padding:16px;';
    document.body.appendChild(m);
  }
  m.innerHTML = `
    <div style="background:var(--white);border-radius:16px;width:100%;max-width:560px;max-height:88vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.15);">
      <div style="padding:20px 24px 16px;border-bottom:1.5px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-family:'DM Serif Display',serif;font-size:18px;color:var(--ink);">AI Email-нагадування</div>
          <div style="font-size:12px;color:var(--warm);margin-top:2px;">Кому: ${esc(recipient)}</div>
        </div>
        <button onclick="document.getElementById('emailModal').remove()" style="width:30px;height:30px;border-radius:6px;border:1.5px solid var(--border);background:transparent;font-size:16px;cursor:pointer;color:var(--warm);">×</button>
      </div>
      <div style="padding:20px 24px;">
        <div id="emailBody" style="font-size:13px;line-height:1.7;color:var(--charcoal);white-space:pre-wrap;background:var(--cream2);border-radius:10px;padding:16px;border:1.5px solid var(--border);font-family:'DM Mono',monospace;">${esc(text)}</div>
      </div>
      <div style="padding:0 24px 20px;display:flex;gap:8px;">
        <button onclick="navigator.clipboard?.writeText(document.getElementById('emailBody').textContent);showToast('Скопійовано','success')" class="btn btn-dark" style="flex:1;padding:11px;">Копіювати</button>
        <button onclick="document.getElementById('emailModal').remove()" class="btn btn-out" style="flex:1;padding:11px;">Закрити</button>
      </div>
    </div>`;
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
}

// ── Board Report Generator ─────────────────────────────
async function generateBoardReport() {
  const btn = document.getElementById('boardReportBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Генерую звіт…'; }

  const prompt = `Ти — CFO, готуєш щомісячний Board Report для ради директорів та інвесторів.

Дані компанії (травень 2026):
• Дохід: ₴996K (+12.4% MoM, +18.6% YoY)
• Витрати: ₴334K операційних (+18.2% MoM) 
• Чистий прибуток: ₴662K (маржа 66.4%)
• Баланс рахунку: ₴2.45M
• Команда: 12 осіб
• CFO Health Score: 74/100 (+4 за місяць)
• MRR: ₴827K (83% від доходу, передбачуваний)

Ключові ризики:
• Beta Solutions прострочена оплата 45 днів (₴185K MRR під ризиком)
• SaaS витрати на 37% вище ринку — марнотратство ₴21.9K/міс виявлено
• Залежність: 22.1% доходу від 1 клієнта (Acme Corp)
• Burn rate ростає +18.2% vs дохід +12.4%

Позитивне:
• Delta Finance +18% MoM (upsell можливість)
• Runway стрес-тест: 77 днів без доходу
• Fraud risk score: 91/100 (контрольовано)

Напиши Board Report українською мовою. Структура:
## Executive Summary
## Ключові метрики (таблиця markdown)
## Фінансові підсумки
## Ризики та мітигація
## Рекомендовані дії (пронумерований список)
## Прогноз на наступний місяць

Стиль: investor-grade, лаконічно, без води. Довжина: 400-600 слів.`;

  try {
    const md = await callClaude(
      'Ти досвідчений CFO SaaS компанії. Пишеш чіткі, структуровані board reports.',
      [{ role:'user', content:prompt }],
      1200
    );
    showReportModal(md);
  } catch (err) {
    showToast('Помилка генерації. Перевірте API ключ.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📄 Генерувати Board Report'; }
  }
}

function _mdToHtml(md) {
  return md
    .replace(/^## (.+)$/gm, '<h3 style="font-family:\'DM Serif Display\',serif;font-size:17px;color:var(--ink);margin:20px 0 8px;padding-bottom:6px;border-bottom:1.5px solid var(--border);">$1</h3>')
    .replace(/^### (.+)$/gm, '<h4 style="font-size:13px;font-weight:700;color:var(--ink);margin:14px 0 6px;">$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\|(.+)\|/g, (row) => {
      const cells = row.split('|').filter(c => c.trim()).map(c => `<td style="padding:6px 12px;border:1px solid var(--border);font-size:12.5px;">${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    })
    .replace(/(<tr>[\s\S]+?<\/tr>)/g, '<table style="width:100%;border-collapse:collapse;margin:10px 0;font-family:\'DM Mono\',monospace;font-size:12px;">$1</table>')
    .replace(/^(\d+)\. (.+)$/gm, '<div style="display:flex;gap:10px;margin:4px 0;font-size:13px;"><span style="font-weight:700;color:var(--ink);flex-shrink:0;">$1.</span><span>$2</span></div>')
    .replace(/^[•\-] (.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0;font-size:13px;"><span style="color:var(--warm);flex-shrink:0;">·</span><span>$1</span></div>')
    .replace(/\n\n/g, '<br>')
    .replace(/\n/g, '');
}

function showReportModal(md) {
  let m = document.getElementById('boardReportModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'boardReportModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;background:rgba(14,12,10,.4);backdrop-filter:blur(3px);padding:16px;';
    document.body.appendChild(m);
  }

  const html = _mdToHtml(md);
  const date = new Date().toLocaleDateString('uk-UA',{year:'numeric',month:'long',day:'numeric'});

  m.innerHTML = `
    <div style="background:var(--white);border-radius:16px;width:100%;max-width:680px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.15);">
      <div style="padding:20px 24px 16px;border-bottom:1.5px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
        <div>
          <div style="font-family:'DM Serif Display',serif;font-size:20px;color:var(--ink);">Board Report</div>
          <div style="font-size:12px;color:var(--warm);margin-top:2px;">Згенеровано AI · ${date}</div>
        </div>
        <button onclick="document.getElementById('boardReportModal').remove()" style="width:30px;height:30px;border-radius:6px;border:1.5px solid var(--border);background:transparent;font-size:16px;cursor:pointer;color:var(--warm);">×</button>
      </div>
      <div id="reportContent" style="flex:1;overflow-y:auto;padding:24px;line-height:1.65;color:var(--charcoal);">${html}</div>
      <div style="padding:16px 24px;border-top:1.5px solid var(--border);display:flex;gap:8px;flex-shrink:0;">
        <button onclick="window.print()" class="btn btn-dark" style="flex:1;padding:11px;">🖨 Друкувати / PDF</button>
        <button onclick="navigator.clipboard?.writeText(${JSON.stringify(md).replace(/'/g,"\\'")}||'');showToast('Скопійовано','success')" class="btn btn-out" style="flex:1;padding:11px;">Копіювати текст</button>
        <button onclick="document.getElementById('boardReportModal').remove()" class="btn btn-out" style="padding:11px 16px;">✕</button>
      </div>
    </div>`;
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
}

// ── Init Chunk 3 ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderAIActions();
});
document.addEventListener('click', e => {
  const p = e.target.closest('.sb-item[data-page]')?.dataset?.page;
  if (p === 'overview') setTimeout(renderAIActions, 50);
});

// ══════════════════════════════════════════════
// CHUNK 4 — Benchmark + Founder/Investor + Cashflow Prediction
// ══════════════════════════════════════════════

// ── BENCHMARK ENGINE ─────────────────────────────────────

const BENCHMARK = {
  industry: 'SaaS · IT · 6–20 осіб · Україна/ЄС',
  n: 847,
  metrics: [
    { label:'Gross Margin',          you:66.4, p50:58.2, p75:70.1, unit:'%',   up:true,  key:'margin' },
    { label:'Revenue Growth (MoM)',  you:12.4, p50:8.5,  p75:15.8, unit:'%',   up:true,  key:'rev_growth' },
    { label:'MRR / Total Revenue',   you:83.0, p50:71.0, p75:86.0, unit:'%',   up:true,  key:'mrr_pct' },
    { label:'SaaS Spend / особу',    you:7792, p50:5800, p75:4200, unit:'₴',   up:false, key:'saas_pp' },
    { label:'Burn Rate Growth',      you:18.2, p50:12.0, p75:7.5,  unit:'%',   up:false, key:'burn_growth' },
    { label:'Payroll / Revenue',     you:15.1, p50:22.0, p75:14.0, unit:'%',   up:false, key:'payroll_ratio' },
    { label:'CAC Payback',           you:4.2,  p50:6.1,  p75:3.0,  unit:'міс', up:false, key:'cac' },
    { label:'NPS Score',             you:68,   p50:52,   p75:72,   unit:'',    up:true,  key:'nps' },
    { label:'Revenue / Employee',    you:83000,p50:65000,p75:95000,unit:'₴',   up:true,  key:'rev_emp' },
    { label:'Churn Rate (MoM)',      you:1.8,  p50:2.5,  p75:1.2,  unit:'%',   up:false, key:'churn' },
  ],
};

function _benchPercentile(you, p50, p75, up) {
  if (up) {
    if (you >= p75) return { rank: 'top25', label: 'Топ 25%', col: 'green' };
    if (you >= p50) return { rank: 'above', label: 'Вище медіани', col: 'green' };
    return { rank: 'below', label: 'Нижче медіани', col: 'red' };
  } else {
    if (you <= p75) return { rank: 'top25', label: 'Топ 25%', col: 'green' };
    if (you <= p50) return { rank: 'above', label: 'Вище медіани', col: 'green' };
    return { rank: 'below', label: 'Нижче медіани', col: 'red' };
  }
}

function _benchBar(you, p50, p75, up) {
  // Position on a 0–max scale
  const all = [you, p50, p75];
  const max = Math.max(...all) * (up ? 1.3 : 1.3);
  const pctYou = Math.min(100, Math.round(you / max * 100));
  const pctP50 = Math.min(100, Math.round(p50 / max * 100));
  const pctP75 = Math.min(100, Math.round(p75 / max * 100));
  const { col } = _benchPercentile(you, p50, p75, up);
  const barCol  = col === 'green' ? 'var(--green)' : 'var(--red)';
  return `
    <div style="position:relative;height:12px;background:var(--cream3);border-radius:6px;margin:6px 0 3px;">
      <div style="position:absolute;left:0;top:0;height:100%;width:${pctYou}%;background:${barCol};border-radius:6px;transition:width .8s ease;"></div>
      <div style="position:absolute;top:-2px;bottom:-2px;left:${pctP50}%;width:2px;background:var(--warm);border-radius:1px;" title="Медіана"></div>
      <div style="position:absolute;top:-3px;bottom:-3px;left:${pctP75}%;width:2px;background:var(--ink);border-radius:1px;" title="Топ 25%"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--warm);">
      <span>0</span>
      <span>┆ Медіана</span>
      <span>┆ Топ 25%</span>
    </div>`;
}

function renderBenchmark() {
  const el = document.getElementById('benchmarkPanel');
  if (!el) return;

  const bm = BENCHMARK;
  const top25count = bm.metrics.filter(m => _benchPercentile(m.you, m.p50, m.p75, m.up).rank === 'top25').length;
  const aboveCount = bm.metrics.filter(m => _benchPercentile(m.you, m.p50, m.p75, m.up).rank === 'above').length;
  const belowCount = bm.metrics.filter(m => _benchPercentile(m.you, m.p50, m.p75, m.up).rank === 'below').length;

  const fmtVal = (v, unit) => {
    if (unit === '₴' && v >= 1000) return '₴' + (v/1000).toFixed(0) + 'K';
    return v + unit;
  };

  const rows = bm.metrics.map(m => {
    const pr = _benchPercentile(m.you, m.p50, m.p75, m.up);
    const COL = { green: 'var(--green)', amber: 'var(--amber)', red: 'var(--red)' };
    const BG  = { green: 'var(--green-bg)', red: 'var(--red-bg)' };
    const vs  = m.up
      ? (m.you >= m.p50 ? `+${(m.you - m.p50).toFixed(m.unit === '₴' ? 0 : 1)}${m.unit} vs медіана` : `${(m.you - m.p50).toFixed(1)}${m.unit} vs медіана`)
      : (m.you <= m.p50 ? `-${(m.p50 - m.you).toFixed(m.unit === '₴' ? 0 : 1)}${m.unit} краще медіани` : `+${(m.you - m.p50).toFixed(1)}${m.unit} гірше медіани`);
    return `
      <div style="padding:14px 0;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;flex-wrap:wrap;gap:6px;">
          <span style="font-size:13px;font-weight:700;color:var(--ink);">${esc(m.label)}</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:11.5px;color:var(--warm);">Ринок: ${fmtVal(m.p50, m.unit)}</span>
            <span style="font-size:14px;font-weight:800;font-family:'DM Mono',monospace;color:${COL[pr.col]};">${fmtVal(m.you, m.unit)}</span>
            <span style="font-size:9.5px;font-weight:800;padding:2px 8px;border-radius:20px;background:${BG[pr.col]||'var(--cream2)'};color:${COL[pr.col]};">${pr.label}</span>
          </div>
        </div>
        ${_benchBar(m.you, m.p50, m.p75, m.up)}
        <div style="font-size:11px;color:${COL[pr.col]};margin-top:4px;font-weight:600;">${esc(vs)}</div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">
      <div style="background:var(--green-bg);border:1px solid #B8DFC5;border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--green);margin-bottom:6px;">Топ 25%</div>
        <div style="font-family:'DM Serif Display',serif;font-size:32px;color:var(--green);">${top25count}</div>
        <div style="font-size:11.5px;color:var(--green);margin-top:3px;">метрик — найкращі</div>
      </div>
      <div style="background:var(--cream);border:1.5px solid var(--border);border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--warm);margin-bottom:6px;">Вище медіани</div>
        <div style="font-family:'DM Serif Display',serif;font-size:32px;color:var(--ink);">${aboveCount}</div>
        <div style="font-size:11.5px;color:var(--warm);margin-top:3px;">метрик — середньо добре</div>
      </div>
      <div style="background:var(--red-bg);border:1px solid #F0C4C0;border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--red);margin-bottom:6px;">Нижче медіани</div>
        <div style="font-family:'DM Serif Display',serif;font-size:32px;color:var(--red);">${belowCount}</div>
        <div style="font-size:11.5px;color:var(--red);margin-top:3px;">метрик — потребують уваги</div>
      </div>
    </div>
    <div class="card" style="border-top:3px solid var(--ink);">
      <div class="card-hd"><div>
        <div class="card-t">Benchmark vs ${esc(bm.industry)}</div>
        <div class="card-s">Вибірка ${bm.n} компаній · Травень 2026 · ┆ = медіана, ┆ = Топ 25%</div>
      </div></div>
      <div style="padding:0 4px;">${rows}</div>
    </div>`;
}

// ── FOUNDER / INVESTOR MODE TOGGLE ───────────────────────

let _investorMode = 'investor'; // 'investor' | 'founder'

const FOUNDER_VIEW = [
  { label:'Runway (місяців)', value:'7.3', sub:'При нульовому доході — 77 днів', col:'amber', icon:'⏱' },
  { label:'Щоденний Burn',   value:'₴11K', sub:'₴334K / 30 днів', col:'red',   icon:'🔥' },
  { label:'Cash у банку',    value:'₴2.45M', sub:'Стабільно · +₴62K цього місяця', col:'green', icon:'🏦' },
  { label:'Net Profit/міс',  value:'₴662K', sub:'Маржа 66.4%', col:'green', icon:'💰' },
  { label:'Витрати завтра',  value:'₴93.5K', sub:'SaaS-цикл 1 черв.', col:'amber', icon:'📅' },
  { label:'Efficiency Ratio',value:'1.48×', sub:'₴1 витрат → ₴1.48 доходу', col:'green', icon:'⚡' },
];

const INVESTOR_VIEW = [
  { label:'MRR',            value:'₴827K', sub:'+12.4% MoM · +18.6% YoY', col:'green', icon:'📈' },
  { label:'NRR',            value:'108%',  sub:'Net Revenue Retention', col:'green', icon:'🔄' },
  { label:'Gross Margin',   value:'66.4%', sub:'Ринок: 58.2% — вище на 8.2%', col:'green', icon:'💎' },
  { label:'Churn (MoM)',    value:'1.8%',  sub:'Ринок: 2.5% — краще', col:'green', icon:'📉' },
  { label:'CAC Payback',    value:'4.2 міс', sub:'Ринок: 6.1 міс', col:'green', icon:'🎯' },
  { label:'LTV/CAC',        value:'8.4×',  sub:'Відмінний показник', col:'green', icon:'🚀' },
];

function switchInvestorMode(mode) {
  _investorMode = mode;
  const btnF = document.getElementById('modeFounder');
  const btnI = document.getElementById('modeInvestor');
  const on  = 'background:var(--ink);color:var(--cream);border-color:var(--ink);';
  const off = 'background:transparent;color:var(--warm);border-color:var(--border);';
  if (btnF) btnF.style.cssText += mode === 'founder' ? on : off;
  if (btnI) btnI.style.cssText += mode === 'investor' ? on : off;
  renderInvestorContent();
}

function renderInvestorContent() {
  const el = document.getElementById('modeMetrics');
  if (!el) return;
  const data = _investorMode === 'founder' ? FOUNDER_VIEW : INVESTOR_VIEW;
  const COL = { green:'var(--green)', amber:'var(--amber)', red:'var(--red)', blue:'var(--blue)' };
  el.innerHTML = data.map(m => `
    <div style="background:var(--cream2);border:1.5px solid var(--border);border-radius:12px;padding:18px;transition:border-color .15s;" onmouseover="this.style.borderColor='var(--ink)'" onmouseout="this.style.borderColor='var(--border)'">
      <div style="font-size:20px;margin-bottom:8px;">${m.icon}</div>
      <div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--warm);margin-bottom:4px;">${esc(m.label)}</div>
      <div style="font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:${COL[m.col]||'var(--ink)'};">${esc(m.value)}</div>
      <div style="font-size:11px;color:var(--warm);margin-top:4px;line-height:1.4;">${esc(m.sub)}</div>
    </div>`).join('');
}

// ── AI CASHFLOW PREDICTION ────────────────────────────────

const CF_PRED = {
  months: [
    {
      label:'Червень 2026', short:'Черв',
      inflow:1_024_000, outflow:352_000, balance_end:3_122_000,
      confidence: 88,
      events: [
        { date:'1 черв', type:'payroll', text:'Виплата зарплат (12 осіб)',      amount:-150_000, certain:true  },
        { date:'5 черв', type:'invoice', text:'Delta Finance — рахунок #1048',   amount:+128_000, prob:92       },
        { date:'12 черв',type:'invoice', text:'Gamma Tech — рахунок #1049',      amount:+156_000, prob:85       },
        { date:'15 черв',type:'tax',     text:'Квартальний ПДВ (Q2)',            amount:-48_000,  certain:true  },
        { date:'20 черв',type:'saas',    text:'Цикл SaaS-підписок',             amount:-93_500,  certain:true  },
        { date:'28 черв',type:'invoice', text:'Beta Solutions (затримка -45д)', amount:+185_000, prob:41       },
      ],
    },
    {
      label:'Липень 2026', short:'Лип',
      inflow:1_068_000, outflow:361_000, balance_end:3_829_000,
      confidence: 74,
      events: [
        { date:'1 лип', type:'payroll', text:'Виплата зарплат',                 amount:-150_000, certain:true  },
        { date:'10 лип',type:'invoice', text:'Acme Corp — рахунок #1051',       amount:+220_000, prob:96       },
        { date:'20 лип',type:'saas',    text:'Цикл SaaS-підписок',              amount:-93_500,  certain:true  },
        { date:'25 лип',type:'tax',     text:'ЄСВ / ПДФО липень',              amount:-32_000,  certain:true  },
      ],
    },
    {
      label:'Серпень 2026', short:'Серп',
      inflow:1_120_000, outflow:375_000, balance_end:4_574_000,
      confidence: 61,
      events: [
        { date:'1 серп', type:'payroll', text:'Виплата зарплат',                amount:-150_000, certain:true  },
        { date:'15 серп',type:'saas',    text:'Цикл SaaS-підписок',             amount:-93_500,  certain:true  },
        { date:'20 серп',type:'invoice', text:'Прогнозні надходження',          amount:+1_000_000,prob:68      },
      ],
    },
  ],
};

function renderCashflowPrediction() {
  const el = document.getElementById('cfPredictionPanel');
  if (!el) return;

  const fmtK = v => v >= 0 ? '+₴' + (v/1000).toFixed(0) + 'K' : '−₴' + (Math.abs(v)/1000).toFixed(0) + 'K';
  const TYPE_ICON = { payroll:'💼', invoice:'📄', tax:'🏛', saas:'💻' };
  const TYPE_COL  = { payroll:'var(--amber)', invoice:'var(--green)', tax:'var(--red)', saas:'var(--blue)' };

  const months = CF_PRED.months.map((m, mi) => {
    const net = m.inflow - m.outflow;
    const netCol = net >= 0 ? 'var(--green)' : 'var(--red)';
    const confCol = m.confidence >= 80 ? 'var(--green)' : m.confidence >= 65 ? 'var(--amber)' : 'var(--red)';

    const events = m.events.map(e => {
      const eCol = e.amount > 0 ? 'var(--green)' : TYPE_COL[e.type] || 'var(--warm)';
      const badge = e.certain
        ? `<span style="font-size:9px;background:var(--cream2);color:var(--warm);padding:1px 6px;border-radius:20px;font-weight:700;">Точно</span>`
        : `<span style="font-size:9px;background:${e.prob>=80?'rgba(42,110,70,.1)':'rgba(184,50,40,.1)'};color:${e.prob>=80?'var(--green)':'var(--red)'};padding:1px 6px;border-radius:20px;font-weight:700;">${e.prob}%</span>`;
      return `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);">
        <span style="font-size:14px;flex-shrink:0;">${TYPE_ICON[e.type]||'·'}</span>
        <div style="flex:1;min-width:0;">
          <span style="font-size:12px;font-weight:600;color:var(--ink);">${esc(e.text)}</span>
          <span style="font-size:11px;color:var(--warm);margin-left:6px;">${esc(e.date)}</span>
        </div>
        ${badge}
        <span style="font-family:'DM Mono',monospace;font-size:13px;font-weight:700;color:${eCol};white-space:nowrap;">${fmtK(e.amount)}</span>
      </div>`;
    }).join('');

    return `
      <div class="card" style="border-top:3px solid ${mi===0?'var(--ink)':'var(--border)'};">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
          <div>
            <div style="font-size:15px;font-weight:700;color:var(--ink);">${esc(m.label)}</div>
            <div style="font-size:11px;color:var(--warm);margin-top:2px;">Прогноз балансу на кінець місяця</div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <div style="text-align:right;">
              <div style="font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--warm);">Net/міс</div>
              <div style="font-family:'DM Mono',monospace;font-size:16px;font-weight:700;color:${netCol};">${fmtK(net)}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--warm);">Баланс кінець</div>
              <div style="font-family:'DM Mono',monospace;font-size:16px;font-weight:700;color:var(--ink);">₴${(m.balance_end/1_000_000).toFixed(2)}M</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--warm);">Точність прогнозу</div>
              <div style="font-family:'DM Mono',monospace;font-size:16px;font-weight:700;color:${confCol};">${m.confidence}%</div>
            </div>
          </div>
        </div>
        <div>${events}</div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div style="margin-top:14px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--warm);margin-bottom:12px;">AI CASHFLOW PREDICTION — НАСТУПНІ 90 ДНІВ</div>
      <div style="display:flex;flex-direction:column;gap:12px;">${months}</div>
      <div style="margin-top:12px;padding:12px 14px;background:var(--cream);border-radius:9px;border-left:3px solid var(--blue);">
        <span style="font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--blue);margin-right:8px;">МОДЕЛЬ</span>
        <span style="font-size:12.5px;color:var(--charcoal);">Прогноз базується на MRR-базі, historical seasonality та ймовірності надходження invoice. Ймовірність Beta Solutions знижена через 45-денну затримку.</span>
      </div>
    </div>`;
}

// ── Init Chunk 4 ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderBenchmark();
  renderInvestorContent();
  renderCashflowPrediction();
});
document.addEventListener('click', e => {
  const p = e.target.closest('.sb-item[data-page]')?.dataset?.page;
  if (p === 'benchmark') setTimeout(renderBenchmark,           50);
  if (p === 'investor')  setTimeout(renderInvestorContent,     50);
  if (p === 'cashflow')  setTimeout(renderCashflowPrediction,  50);
});
