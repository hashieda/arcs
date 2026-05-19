/* =================================================================
   arcs — 共通レンダリングロジック（JSON fetch方式）
   ※このファイルは通常編集不要。更新は data/*.json を編集する。

   【各ページからの呼び出し方】
   ─────────────────────────────────────────────
   全体ビュー（index.html）:
     initView({ mode: 'overview' });

   製品別詳細ビュー:
     initView({ mode: 'detail',
                containerId: 'gantt-seishi',
                dataFile: 'data/seishi_detail.json' });
   ─────────────────────────────────────────────

   【データファイル構成】
     data/meta.json          基本設定・イベント・サマリ
     data/ranshi.json        卵子AI（全体ビュー用）
     data/seishi.json        精子AI（全体ビュー用）
     data/icsi.json          ICSI自動化（全体ビュー用）
     data/ranshi_detail.json 卵子AI 詳細
     data/seishi_detail.json 精子AI 詳細
     data/icsi_detail.json   ICSI自動化 詳細
     data/history.json       更新履歴ログ
   ================================================================= */

'use strict';

const PHASE_BAR_HEIGHT = 22;
const PHASE_BAR_GAP    = 5;
const PHASE_TRACK_PAD  = 8;

/* ─── JSON fetch ─── */
async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} の読み込みに失敗しました (HTTP ${res.status})`);
  return res.json();
}

/* ─── 月ラベル変換 ─── */
function makeMonthLabel(meta, idx) {
  const yi = Math.min(Math.floor(idx / 12), (meta.yearLabels || []).length - 1);
  return `${(meta.yearLabels || [])[yi] || ''} ${(meta.monthLabels || [])[idx] || ''}月`;
}

/* ─── サマリ集計・描画 ───
   manualSummary.warnings が空のとき riskLevel/delayReason から自動生成 */
function buildSummary(meta, products) {
  const ms = meta.manualSummary || {};
  const autoWarnings = [], autoDelays = [];
  products.forEach(p => {
    (p.categories || []).forEach(cat => {
      (cat.themes || []).forEach(t => {
        if (t.status === 'red' && t.delayReason)
          autoDelays.push(`<strong>${p.name} / ${t.name}</strong>：${t.delayReason}`);
        if ((t.riskLevel === 'high' || t.riskLevel === 'medium') && t.riskComment)
          autoWarnings.push(`<strong>${p.name} / ${t.name}</strong>：${t.riskComment}`);
      });
    });
  });
  return {
    actions:  ms.actions  || [],
    warnings: (ms.warnings && ms.warnings.length > 0) ? ms.warnings : autoWarnings,
    dones:    ms.dones    || [],
    delays:   autoDelays
  };
}

function renderSummary(summary) {
  const set = (id, arr) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = (arr || []).map(a => `<li>${a}</li>`).join('');
  };
  set('action-list', summary.actions);
  set('warning-list', summary.warnings);
  set('done-list', summary.dones);
  const dc = document.getElementById('delay-card');
  if (dc) {
    const has = summary.delays && summary.delays.length > 0;
    dc.style.display = has ? '' : 'none';
    if (has) set('delay-list', summary.delays);
  }
}

/* ─── 更新履歴 ─── */
const TAG_LABEL  = { delay:'遅延', risk:'リスク', progress:'進捗', plan:'計画', done:'完了', update:'更新' };
const PROD_LABEL = { ranshi:'🥚卵子AI', seishi:'🧬精子AI', icsi:'🔬ICSI', all:'全体' };

function renderHistory(history) {
  const el = document.getElementById('history-list');
  if (!el || !history) return;
  el.innerHTML = (history.entries || []).map(e =>
    `<li><span class="cl-date">${e.date}</span>` +
    (PROD_LABEL[e.product] ? `<span class="cl-tag ${e.type}">${PROD_LABEL[e.product]}</span>` : '') +
    `<span class="cl-tag ${e.type}">${TAG_LABEL[e.type] || e.type}</span>` +
    `${e.text}</li>`
  ).join('');
}

/* ─── リスクバッジ ─── */
function riskBadgeHTML(t) {
  if (!t.riskLevel) return '';
  const lv = t.riskLevel;
  return `<span class="risk-badge ${lv}">${lv==='high'?'⚠':lv==='medium'?'△':'ℹ'} リスク${lv==='high'?'高':lv==='medium'?'中':'低'}</span>`;
}

/* ─── リスク・遅延コメント ─── */
function riskCommentHTML(t) {
  let h = '';
  if (t.status === 'red' && t.delayReason) {
    h += `<span class="risk-comment high"><span class="rc-head">⏰ ${t.delayMonths ? t.delayMonths + 'ヶ月遅延 ' : '遅延 '}<span class="rc-date">${t.delayDate||''}</span></span>${t.delayReason}</span>`;
  }
  if (t.riskLevel && t.riskComment) {
    const lv = t.riskLevel;
    h += `<span class="risk-comment ${lv}"><span class="rc-head">リスク${lv==='high'?'高':lv==='medium'?'中':'低'} <span class="rc-date">${t.riskDate||''}</span></span>${t.riskComment}</span>`;
  }
  return h;
}

/* ─── タイムラインヘッダー ─── */
function renderTimelineLane(meta) {
  const total = (meta.monthLabels || []).length;
  const yrs   = meta.yearLabels || [];
  // year-end indices: every 12th month boundary (idx 11, 23, 35…) within range
  const yearEnds = meta.yearEnds || Array.from({length: yrs.length - 1}, (_, i) => (i + 1) * 12 - 1);

  // year-row: each label spans its 12 months proportionally
  let h = '<div class="timeline-lane"><div class="year-row">';
  yrs.forEach(y => { h += `<div>${y}</div>`; });
  h += '</div><div class="month-row-h">';
  (meta.monthLabels || []).forEach((m, i) => {
    const cls = [];
    if (i === meta.todayMonthIdx) cls.push('is-current');
    if (yearEnds.includes(i))     cls.push('year-end');
    h += `<div${cls.length ? ` class="${cls.join(' ')}"` : ''}>${m}</div>`;
  });
  return h + '</div></div>';
}

/* ─── イベント行 ─── */
function renderEventRow(meta) {
  const total    = (meta.monthLabels || []).length;
  const yearEnds = meta.yearEnds || Array.from({length: (meta.yearLabels||[]).length - 1}, (_, i) => (i+1)*12-1);
  let h = '<div class="event-row"><div class="event-label">Event</div><div class="event-track">';
  for (let m = 0; m < total; m++) {
    const cls = ['event-cell'];
    if (yearEnds.includes(m))    cls.push('year-end');
    if (m === meta.todayMonthIdx) cls.push('is-current');
    h += `<div class="${cls.join(' ')}">`;
    (meta.events[String(m)] || []).forEach(ev => {
      const tt = encodeURIComponent(JSON.stringify({ type:'event', text:ev.text, month:makeMonthLabel(meta,m), evType:ev.type }));
      h += `<div class="event-item ${ev.type}" data-tt="${tt}">${ev.text}</div>`;
    });
    h += '</div>';
  }
  return h + '</div><div class="event-spacer">マイルストーン</div></div>';
}

/* ─── ガントヘッダー ─── */
function renderGanttHeader(meta) {
  return `<div class="gantt-row header">` +
    `<div class="col-label-left" style="grid-column:1/3">カテゴリ ／ テーマ</div>` +
    renderTimelineLane(meta) +
    `<div class="col-label-right">ステータス ／ 次の山場・リスク</div></div>`;
}

/* ─── 製品ブロック ─── */
function renderProductBlock(meta, prod) {
  const total = (meta.monthLabels || []).length;
  let h = `<div class="product-header ${prod.headerClass}"><span>${prod.name}</span></div>`;
  h += '<div class="product-block">';
  (prod.categories || []).forEach(cat => {
    const themes = cat.themes || [];
    themes.forEach((t, idx) => {
      const trackH = t.phases.length * PHASE_BAR_HEIGHT + (t.phases.length - 1) * PHASE_BAR_GAP + PHASE_TRACK_PAD * 2;
      if (idx === 0)
        h += `<div class="pb-cell col-category ${cat.catClass}" style="grid-row:span ${themes.length}" data-status="${t.status}">${cat.cat}</div>`;

      // 名前列
      h += `<div class="pb-cell col-name theme-row" data-status="${t.status}" data-theme="${t.id}">` +
           `<div class="name-line"><span class="signal ${t.status}"></span><span class="theme-name">${t.name}</span>${riskBadgeHTML(t)}</div>` +
           `<span class="meta">${t.period}</span><span class="meta">${t.owner}</span></div>`;

      // ガントエリア
      h += `<div class="pb-cell theme-gantt theme-row" data-status="${t.status}" data-theme="${t.id}">` +
           `<div class="phase-tracks" style="height:${trackH}px;">`;
      t.phases.forEach((p, pi) => {
        const left = (p.start / total) * 100;
        const w    = ((p.end - p.start + 1) / total) * 100;
        const top  = PHASE_TRACK_PAD + pi * (PHASE_BAR_HEIGHT + PHASE_BAR_GAP);
        const ext  = [p.delayed ? 'delayed' : '', p.baseline ? 'baseline' : ''].filter(Boolean).join(' ');
        const tt   = encodeURIComponent(JSON.stringify({
          type:'phase', phaseLabel:p.label, themeName:t.name,
          startMonth:makeMonthLabel(meta,p.start), endMonth:makeMonthLabel(meta,p.end),
          tasks:p.tasks||[], memo:p.memo||(p.baseline?'（当初計画）':'')
        }));
        h += `<div class="phase-bar ${p.phase||'navy'} arrow ${ext}" ` +
             `style="left:calc(${left}% + 2px);width:calc(${w}% - 6px);top:${top}px;height:${PHASE_BAR_HEIGHT}px" ` +
             `data-tt="${tt}">${p.label}</div>`;
      });
      h += '</div></div>';

      // ステータス列
      h += `<div class="pb-cell col-status theme-row" data-status="${t.status}" data-theme="${t.id}">` +
           `<span class="signal ${t.status}"></span>` +
           `<div class="milestone-text"><strong>${t.next||'—'}</strong><div class="owner">${t.owner}</div>` +
           (t.warningNote ? `<span class="dep">⚠ ${t.warningNote}</span>` : '') +
           riskCommentHTML(t) + '</div></div>';
    });
  });
  return h + '</div>';
}

/* ─── TODAYライン ─── */
function addTodayLine(meta) {
  const total = (meta.monthLabels || []).length;
  const yearCount = (meta.yearLabels || []).length;
  document.querySelectorAll('.gantt-container').forEach(c => {
    // グリッド列数をCSS変数で全グリッドに統一注入
    c.style.setProperty('--gantt-cols-pct', `calc(100% / ${total})`);
    c.style.setProperty('--gantt-month-count', total);
    c.style.setProperty('--gantt-year-count', yearCount);
    const g = c.querySelector('.theme-gantt');
    if (!g) return;
    const cR = c.getBoundingClientRect(), gR = g.getBoundingClientRect();
    const x  = gR.left - cR.left + (gR.width / total) * (meta.todayMonthIdx + 0.5);
    c.querySelector('.today-line')?.remove();
    const line = document.createElement('div');
    line.className = 'today-line';
    line.style.left = x + 'px';
    const hdr = c.querySelector('.gantt-row.header');
    const all = c.querySelectorAll('.theme-gantt');
    const last = all[all.length - 1];
    if (hdr && last) {
      const hR = hdr.getBoundingClientRect(), lR = last.getBoundingClientRect();
      line.style.top    = (hR.bottom - cR.top - 12) + 'px';
      line.style.height = (lR.bottom - hR.bottom + 12) + 'px';
    }
    c.appendChild(line);
  });
}

/* ─── ツールチップ ─── */
let _tt;
function showTT(e) {
  try { _tt.innerHTML = buildTTHTML(JSON.parse(decodeURIComponent(e.currentTarget.dataset.tt))); _tt.style.display='block'; moveTT(e); } catch(_){}
}
function buildTTHTML(d) {
  if (d.type==='phase') {
    const tl = (d.tasks||[]).length ? '<ul>'+d.tasks.map(t=>`<li>${t}</li>`).join('')+'</ul>' : '';
    const ml = d.memo ? `<div class="tt-memo">${d.memo}</div>` : '';
    return `<h5>${d.phaseLabel}</h5><div class="tt-period">📅 ${d.startMonth} 〜 ${d.endMonth}　／　${d.themeName}</div>${tl}${ml}`;
  }
  if (d.type==='event') return `<h5>${d.text}</h5><div class="tt-period">📅 ${d.month}</div>`;
  return '';
}
function moveTT(e) {
  const r=_tt.getBoundingClientRect(); let x=e.clientX+14, y=e.clientY+14;
  if(x+r.width >window.innerWidth -8) x=e.clientX-r.width -14;
  if(y+r.height>window.innerHeight-8) y=e.clientY-r.height-14;
  _tt.style.left=Math.max(8,x)+'px'; _tt.style.top=Math.max(8,y)+'px';
}
function hideTT() { _tt.style.display='none'; }
function attachTooltips() {
  document.querySelectorAll('[data-tt]').forEach(el => {
    el.removeEventListener('mouseenter',showTT); el.removeEventListener('mousemove',moveTT); el.removeEventListener('mouseleave',hideTT);
    el.addEventListener('mouseenter',showTT); el.addEventListener('mousemove',moveTT); el.addEventListener('mouseleave',hideTT);
  });
}

/* ─── フィルタ ─── */
function setupFilter() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const f = btn.dataset.filter;
      document.querySelectorAll('.theme-row[data-status]').forEach(c => {
        c.style.opacity = (f==='all' || c.dataset.status===f) ? '1' : '0.18';
      });
    });
  });
}

/* ─── エラー表示 ─── */
function showError(msg) {
  document.body.innerHTML = `<div style="padding:40px;font-family:sans-serif;color:#B91C1C;">
    <h2>データ読み込みエラー</h2><p>${msg}</p>
    <p style="color:#6B7280;font-size:13px;">
    ⚠️ file:// で直接開いている場合は <code>python3 -m http.server 8000</code> で起動してからアクセスしてください。
    </p></div>`;
}

/* ─── ローディング ─── */
function showLoading(id) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = '<div style="padding:40px;text-align:center;color:#6B7280;font-size:13px;">読み込み中…</div>';
}

/* ─────────────────────────────────────────
   メインエントリポイント
   opts: { mode:'overview' }
       | { mode:'detail', containerId, dataFile }
───────────────────────────────────────── */
async function initView(opts) {
  _tt = document.getElementById('custom-tooltip');

  /* CSS変数をコンテナに即注入するヘルパー */
  function setGridVars(meta) {
    const total = (meta.monthLabels || []).length;
    const yearCount = (meta.yearLabels || []).length;
    document.querySelectorAll('.gantt-container').forEach(c => {
      c.style.setProperty('--gantt-month-count', total);
      c.style.setProperty('--gantt-year-count', yearCount);
      c.style.setProperty('--gantt-cols-pct', `calc(100% / ${total})`);
    });
  }

  if (opts.mode === 'overview') {
    showLoading('gantt-overview');
    try {
      const [meta, ranshi, seishi, icsi, history] = await Promise.all([
        fetchJSON('data/meta.json'),
        fetchJSON('data/ranshi.json'),
        fetchJSON('data/seishi.json'),
        fetchJSON('data/icsi.json'),
        fetchJSON('data/history.json')
      ]);
      const ud = document.getElementById('update-date');
      if (ud) ud.textContent = meta.todayDate;

      renderSummary(buildSummary(meta, [ranshi, seishi, icsi]));

      const c = document.getElementById('gantt-overview');
      c.innerHTML = renderGanttHeader(meta) + renderEventRow(meta)
        + renderProductBlock(meta, ranshi)
        + renderProductBlock(meta, seishi)
        + renderProductBlock(meta, icsi);

      setGridVars(meta);
      renderHistory(history);
      attachTooltips(); setupFilter();
      setTimeout(() => addTodayLine(meta), 100);
      window.addEventListener('resize', () => setTimeout(() => addTodayLine(meta), 80));
    } catch(e) { showError(e.message); }
    return;
  }

  if (opts.mode === 'detail') {
    showLoading(opts.containerId);
    try {
      const [baseMeta, product, history] = await Promise.all([
        fetchJSON('data/meta.json'),
        fetchJSON(opts.dataFile),
        fetchJSON('data/history.json')
      ]);

      // productData.meta が存在する場合（ICSI等45ヶ月対応）は上書きマージ
      // todayDate / todayMonthIdx / events / manualSummary は base から引き継ぎ
      const meta = product.meta
        ? { ...baseMeta, ...product.meta,
            todayDate: baseMeta.todayDate,
            todayMonthIdx: baseMeta.todayMonthIdx,
            events: baseMeta.events,
            manualSummary: baseMeta.manualSummary }
        : baseMeta;

      const ud = document.getElementById('update-date');
      if (ud) ud.textContent = meta.todayDate;

      renderSummary(buildSummary(meta, [product]));

      const c = document.getElementById(opts.containerId);
      c.innerHTML = renderGanttHeader(meta) + renderEventRow(meta)
        + renderProductBlock(meta, product);

      setGridVars(meta);
      renderHistory(history);
      attachTooltips(); setupFilter();
      setTimeout(() => addTodayLine(meta), 100);
      window.addEventListener('resize', () => setTimeout(() => addTodayLine(meta), 80));
    } catch(e) { showError(e.message); }
  }
}
