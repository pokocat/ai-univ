/* 盛杰运营平台 · 统一后台 —— 桌面 H5 原型
   纯静态：无后端、无网络请求、无依赖。 */
(function () {
  'use strict';

  var D = window.DATA;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- 工具 */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmt(n) { return n.toLocaleString('zh-Hans-CN'); }

  var toastTimer;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('toast--on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('toast--on'); }, 2200);
  }

  function openModal(title, html, wide) {
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = html;
    $('#modal').querySelector('.modal__panel').classList.toggle('modal__panel--wide', !!wide);
    $('#modal').hidden = false;
  }
  function closeModal() { $('#modal').hidden = true; }

  function daysToExpo() {
    var d = Math.ceil((new Date(2026, 9, 10) - new Date()) / 864e5);
    return d > 0 ? d : 0;
  }

  /* ---------------------------------------------------------------- 路由 */
  var ROUTES = {
    '/overview':   { name: '工作台',     icon: 'grid',  view: viewOverview, mount: mountOverview },
    '/events':     { name: '活动',       icon: 'cal',   view: viewEvents },
    '/ops':        { name: '运营计划',   icon: 'plan',  view: viewOps },
    '/channels':   { name: '渠道',       icon: 'fork',  view: viewChannels },
    '/exhibitors': { name: '参展商',     icon: 'shop',  view: viewExhibitors },
    '/finance':    { name: '订单与分账', icon: 'coin',  view: viewFinance },
    '/ai':         { name: '社群与 AI',  icon: 'spark', view: viewAI }
  };

  var ICONS = {
    grid:  '<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/>',
    cal:   '<rect x="3.6" y="5.2" width="16.8" height="14.6" rx="2.4"/><path d="M3.6 9.7h16.8M8.2 3.5v3.4M15.8 3.5v3.4"/>',
    fork:  '<circle cx="6.5" cy="5.5" r="2.1"/><circle cx="6.5" cy="18.5" r="2.1"/><circle cx="17.5" cy="12" r="2.1"/><path d="M6.5 7.6v8.8M8.5 6.5l6.9 4.3M8.5 17.5l6.9-4.3"/>',
    shop:  '<path d="M3.8 9.2 5.3 4.8h13.4l1.5 4.4"/><path d="M5.4 9.2v10h13.2v-10"/><path d="M9.5 19.2v-5.4h5v5.4"/>',
    coin:  '<circle cx="12" cy="12" r="8.2"/><path d="M12 7.4v9.2M15 9.3c-.6-1-1.7-1.5-3-1.5-1.7 0-2.9.8-2.9 2.1 0 2.9 6 1.5 6 4.3 0 1.3-1.3 2.2-3.1 2.2-1.4 0-2.6-.6-3.2-1.6"/>',
    spark: '<path d="M12 3.6c.5 3.9 2.4 6 6.4 6.4-4 .5-5.9 2.5-6.4 6.4-.5-3.9-2.4-5.9-6.4-6.4 4-.4 5.9-2.5 6.4-6.4Z"/><path d="M18.6 14.8c.3 1.9 1.2 2.9 3 3.1-1.8.3-2.7 1.3-3 3.1-.3-1.8-1.2-2.8-3-3.1 1.8-.2 2.7-1.2 3-3.1Z"/>',
    plan:  '<path d="M6.4 4.2h11.2a1.8 1.8 0 0 1 1.8 1.8v13.8H4.6V6a1.8 1.8 0 0 1 1.8-1.8Z"/><path d="M8.4 9.2h7.2M8.4 13h7.2M8.4 16.4h4.2"/>'
  };
  function icon(k) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[k] || '') + '</svg>';
  }

  function path() {
    var h = location.hash.replace(/^#/, '');
    return ROUTES[h] ? h : '/overview';
  }

  var tickerTimer = null;

  function render() {
    var p = path(), r = ROUTES[p];

    /* 离开工作台 / 运营计划时停掉定时器 */
    if (tickerTimer) { clearInterval(tickerTimer); tickerTimer = null; }
    if (genTimer) { clearInterval(genTimer); genTimer = null; }

    $('#nav').innerHTML = Object.keys(ROUTES).map(function (k) {
      var it = ROUTES[k], on = k === p;
      return '<a class="navi' + (on ? ' navi--on' : '') + '" href="#' + k + '"' +
        (on ? ' aria-current="page"' : '') + '>' + icon(it.icon) + '<span>' + it.name + '</span></a>';
    }).join('');

    $('#top-count').textContent = '距开展 ' + daysToExpo() + ' 天';

    var view = $('#view');
    view.innerHTML = r.view();
    view.scrollTop = 0;
    if (r.mount) r.mount(view);

    renderTalkFab(p);
    document.title = r.name + ' · 盛杰运营平台统一后台';
  }

  /* ------------------------------------------------------------ 通用组件 */
  function secHead(t, note) {
    return '<div class="sec__head"><h3 class="sec__title">' + esc(t) + '</h3>' +
      (note ? '<span class="sec__note">' + esc(note) + '</span>' : '') + '</div>';
  }

  /* 横向条形（单色系 · 数量级） */
  function hbars(rows, opts) {
    var max = rows.reduce(function (m, r) { return Math.max(m, r.v); }, 1);
    return rows.map(function (r) {
      var w = Math.max(4, Math.round(r.v / max * 100));
      var tip = esc(r.n || r.k) + ' · ' + fmt(r.v) + (r.r ? '（转化 ' + r.r + '）' : '');
      return '<div class="hbar" data-tip="' + tip + '">' +
        '<span class="hbar__k">' + esc(r.n || r.k) + '</span>' +
        '<span class="hbar__track"><i style="width:' + w + '%"></i></span>' +
        '<b class="hbar__v">' + fmt(r.v) + '</b></div>';
    }).join('');
  }

  function pillSt(st, txt) {
    return '<span class="pill pill--' + st + '">' + esc(txt) + '</span>';
  }

  /* ------------------------------------------------------------- 工作台 */
  function ledgerRow(o, fresh) {
    return '<div class="lrow' + (fresh ? ' lrow--new' : '') + '">' +
      '<div class="lrow__txt"><div class="lrow__t">' + esc(o.t) + '</div>' +
      '<div class="lrow__d">' + esc(o.who) + ' · ' + esc(o.at) + '</div></div>' +
      '<b class="lrow__amt">+' + fmt(o.amt) + '</b></div>';
  }

  function viewOverview() {
    var O = D.overview;

    var kpis = O.kpis.map(function (s) {
      return '<div class="kpi"><span class="kpi__k">' + esc(s.k) + '</span>' +
        '<b class="kpi__v">' + esc(s.v) + '</b><span class="kpi__d">' + esc(s.d) + '</span></div>';
    }).join('');

    var split = O.split.map(function (s) {
      return '<div class="srow"><span>' + esc(s.n) + '</span><span class="srow__r">' + esc(s.r) + '</span><b>' + esc(s.v) + '</b></div>';
    }).join('');

    var TS = { done: '已完成', doing: '进行中', todo: '待处理' };
    var tasks = O.tasks.map(function (t) {
      return '<div class="trow"><span class="pill pill--' + t.s + '">' + TS[t.s] + '</span>' +
        '<span class="trow__t">' + esc(t.t) + '</span></div>';
    }).join('');

    var vp = O.vasProgress;
    var vasTop = vp.top.map(function (x) {
      return '<div class="vtag"><span>' + esc(x.n) + '</span><b>' + x.v + '</b></div>';
    }).join('');

    return '<div class="page">' +
      '<div class="page__head"><h2 class="page__title">工作台</h2>' +
      '<span class="page__note">招商期 · 演示数据</span></div>' +

      '<div class="grid">' +

        '<div class="card card--ink span-4">' +
          '<span class="kpi__k kpi__k--dim">今日到账</span>' +
          '<b class="hero" id="hero-in">¥' + fmt(O.todayIn) + '</b>' +
          '<span class="kpi__d kpi__d--dim">增值服务 + 会员收入 · 实时</span>' +
        '</div>' +
        '<div class="span-8 kpis">' + kpis + '</div>' +

        '<div class="card span-5">' + secHead('到账流水', '每一笔实时进账') +
          '<div class="ledger" id="ledger">' + O.ledger.map(function (o) { return ledgerRow(o); }).join('') + '</div>' +
        '</div>' +

        '<div class="card span-7">' + secHead('渠道排行', '预登记来源 · 一人一码') +
          '<div class="hbars">' + hbars(O.channels) + '</div>' +
          '<div class="card__foot"><a class="more" href="#/channels">看全部渠道 →</a></div>' +
        '</div>' +

        '<div class="card span-4">' + secHead('今日分账', '支付时自动拆分') +
          split +
          '<div class="srow srow--sum"><span>我的可提现余额</span><b>' + esc(O.balance) + '</b></div>' +
          '<button type="button" class="btn" data-act="withdraw">申请提现</button>' +
        '</div>' +

        '<div class="card span-4">' + secHead('参展商增值', vp.done + ' / ' + vp.total + ' 家已开通') +
          '<div class="prog" data-tip="增值包开通 ' + vp.done + ' / ' + vp.total + ' 家"><i style="width:' + Math.round(vp.done / vp.total * 100) + '%"></i></div>' +
          '<div class="vtags">' + vasTop + '</div>' +
          '<div class="card__foot"><a class="more" href="#/exhibitors">看参展商明细 →</a></div>' +
        '</div>' +

        '<div class="card span-4">' + secHead('今日运营任务', '素材已备好') + tasks + '</div>' +

      '</div>' +
    '</div>';
  }

  function mountOverview() {
    var O = D.overview;

    /* 英雄数字滚动进场 */
    var hero = $('#hero-in');
    if (hero && !reduceMotion) {
      var from = Math.max(0, O.todayIn - 2400), t0 = null;
      var step = function (ts) {
        if (!t0) t0 = ts;
        var k = Math.min(1, (ts - t0) / 600);
        hero.textContent = '¥' + fmt(Math.round(from + (O.todayIn - from) * (1 - Math.pow(1 - k, 3))));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    /* 到账流水：每 5 秒进一笔 */
    var poolIdx = 0, extra = 0;
    tickerTimer = setInterval(function () {
      var box = $('#ledger');
      if (!box) return;
      var o = O.ledgerPool[poolIdx % O.ledgerPool.length];
      poolIdx++;
      extra += o.amt;
      var now = new Date();
      var at = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
      box.insertAdjacentHTML('afterbegin', ledgerRow({ t: o.t, who: o.who, amt: o.amt, at: at }, !reduceMotion));
      while (box.children.length > 7) box.removeChild(box.lastElementChild);
      var hero2 = $('#hero-in');
      if (hero2) hero2.textContent = '¥' + fmt(O.todayIn + extra);
    }, 5000);
  }

  /* --------------------------------------------------------------- 活动 */
  function viewEvents() {
    var E = D.events;

    var rows = E.rows.map(function (r) {
      return '<tr><td><b>' + esc(r.n) + '</b></td><td>' + esc(r.kind) + '</td>' +
        '<td class="mono">' + esc(r.time) + '</td><td>' + pillSt(r.st, r.stTxt) + '</td>' +
        '<td class="num">' + esc(r.num) + '</td>' +
        '<td class="num">' + (r.st === 'end'
          ? '<button type="button" class="minibtn" data-act="recap">复盘报告</button>'
          : '<span class="mute">进行中</span>') + '</td></tr>';
    }).join('');

    return '<div class="page">' +
      '<div class="page__head"><h2 class="page__title">活动</h2>' +
      '<span class="page__note">一套模板 · 多个皮肤</span></div>' +
      '<div class="grid">' +
        '<div class="card span-8">' + secHead('活动列表', '含线上与线下') +
          '<table class="tbl"><thead><tr><th>活动</th><th>类型</th><th>档期</th><th>状态</th>' +
          '<th class="num">报名情况</th><th class="num">复盘</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table>' +
          '<p class="note">' + esc(E.note) + '</p>' +
        '</div>' +
        '<div class="card span-4">' + secHead('票种 · 美博会', '按票种配置报名字段') +
          '<div class="hbars">' + hbars(E.tickets) + '</div>' +
          '<p class="note">观众免填公司资质字段；参展商证走审核 + 合同；票码入场即签到。</p>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ----------------------------------------------------------- 运营计划 */
  var ST_TXT = { sent: '已下发', draft: '待终审', todo: '未开始' };
  var ST_PILL = { sent: 'open', draft: 'doing', todo: 'todo' };

  function viewOps() {
    var O = D.ops;

    var rail = O.phases.map(function (p) {
      return '<div class="ph ph--' + p.st + '">' +
        '<div class="ph__rail"><i></i><span></span></div>' +
        '<div class="ph__body">' +
          '<div class="ph__head"><b>' + esc(p.t) + '</b><em>' + esc(p.k) + '</em>' +
            (p.st === 'now' ? '<span class="ph__now">进行中</span>' : '') + '</div>' +
          '<p class="ph__d">' + esc(p.d) + '</p>' +
          '<div class="ph__kpi">' + esc(p.kpi) + '</div>' +
        '</div></div>';
    }).join('');

    var items = O.today.items.map(function (it) {
      return '<div class="dis"><div class="dis__txt"><div class="dis__r">' + esc(it.r) +
        '<span class="dis__n">' + it.n + ' 人</span></div>' +
        '<div class="dis__d">' + esc(it.d) + '</div></div>' +
        pillSt(ST_PILL[it.st], ST_TXT[it.st]) + '</div>';
    }).join('');

    return '<div class="page">' +
      '<div class="page__head"><h2 class="page__title">运营计划</h2>' +
      '<span class="page__note">' + esc(O.today.date) + ' · 第34届北京美博会</span></div>' +
      '<div class="grid">' +

        '<div class="card span-7">' + secHead('传播节奏', 'T-60 → T+14') + '<div class="phs">' + rail + '</div></div>' +

        '<div class="span-5 stack">' +
          '<div class="card">' + secHead('今日素材下发', esc(O.today.title)) + items + '</div>' +
          '<div class="card gencard">' +
            '<div class="gencard__t">一键生成明日全员素材包</div>' +
            '<p class="gencard__d">126 家参展商 + 42 名工作人员，每人一套不同表达，按展会规格出图。</p>' +
            '<button type="button" class="btn" data-act="gen">开始生成</button>' +
            '<div class="genlog" id="genlog" hidden></div>' +
          '</div>' +
        '</div>' +

      '</div>' +
    '</div>';
  }

  /* 素材包生成：逐条打点，最后给结果 */
  var genTimer = null;
  function runGen(btn) {
    if (genTimer) return;
    var box = $('#genlog');
    if (!box) return;
    btn.disabled = true;
    btn.textContent = '生成中…';
    box.hidden = false;
    box.innerHTML = '';

    var steps = D.ops.genSteps, i = 0;
    genTimer = setInterval(function () {
      if (!$('#genlog')) { clearInterval(genTimer); genTimer = null; return; }
      if (i < steps.length) {
        box.insertAdjacentHTML('beforeend',
          '<div class="genlog__r"><i></i><span>' + esc(steps[i]) + '</span></div>');
        i++;
        return;
      }
      clearInterval(genTimer); genTimer = null;
      box.insertAdjacentHTML('beforeend',
        '<div class="genlog__done">已生成 168 套素材 · 2 条待人工复核 · 明早 8:00 自动下发</div>');
      btn.disabled = false;
      btn.textContent = '重新生成';
      toast('素材包已生成（演示）');
    }, 520);
  }

  /* 会后复盘报告 */
  function openRecap() {
    var R = D.recap;
    var max = R.funnel[0].v;
    var funnel = R.funnel.map(function (f) {
      var w = Math.max(6, Math.round(f.v / max * 100));
      return '<div class="hbar"><span class="hbar__k">' + esc(f.k) + '</span>' +
        '<span class="hbar__track"><i style="width:' + w + '%"></i></span>' +
        '<b class="hbar__v">' + fmt(f.v) + '</b></div>';
    }).join('');

    var rows = R.rows.map(function (r) {
      return '<div class="rc"><span class="rc__k">' + esc(r.k) + '</span>' +
        '<b class="rc__v">' + esc(r.v) + '</b><span class="rc__d">' + esc(r.d) + '</span></div>';
    }).join('');

    var finds = R.findings.map(function (f) {
      return '<div class="find"><span class="find__lv find__lv--' + f.cls + '">' + esc(f.lv) + '</span>' +
        '<div><b>' + esc(f.t) + '</b><p>' + esc(f.d) + '</p></div></div>';
    }).join('');

    openModal('会后复盘报告 · ' + R.event,
      '<div class="recap">' +
        '<div class="recap__meta">' + esc(R.period) + ' · 由系统自动生成</div>' +
        '<p class="recap__sum">' + esc(R.summary) + '</p>' +
        '<div class="recap__sec">转化漏斗</div><div class="hbars">' + funnel + '</div>' +
        '<div class="recap__sec">关键指标</div><div class="rcs">' + rows + '</div>' +
        '<div class="recap__sec">三条结论</div><div class="stack" style="gap:8px">' + finds + '</div>' +
        '<div class="recap__next"><b>下一轮建议</b><p>' + esc(R.next) + '</p></div>' +
        '<button type="button" class="btn" data-act="print" style="margin-top:14px">导出 PDF</button>' +
      '</div>', true);
  }

  /* --------------------------------------------------------------- 渠道 */
  function viewChannels() {
    var C = D.channels;

    var rows = C.rows.map(function (r) {
      return '<tr><td class="mono">' + esc(r.code) + '</td><td><b>' + esc(r.who) + '</b></td>' +
        '<td>' + esc(r.tier) + '</td><td class="num mono">' + esc(r.reach) + '</td>' +
        '<td class="num mono">' + esc(r.reg) + '</td><td class="num mono">' + esc(r.cv) + '</td></tr>';
    }).join('');

    return '<div class="page">' +
      '<div class="page__head"><h2 class="page__title">渠道</h2>' +
      '<span class="page__note">访问 → 报名 → 到场全链路归因</span></div>' +
      '<div class="grid">' +
        '<div class="card span-5">' + secHead('总漏斗', '全渠道合并') +
          '<div class="hbars">' + hbars(C.funnel) + '</div>' +
          '<p class="note">' + esc(C.antifraud) + '</p>' +
        '</div>' +
        '<div class="card span-7">' + secHead('一人一码', '按登记量排序') +
          '<table class="tbl"><thead><tr><th>码</th><th>归属</th><th>层级</th>' +
          '<th class="num">触达</th><th class="num">登记</th><th class="num">转化</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ------------------------------------------------------------- 参展商 */
  function viewExhibitors() {
    var X = D.exhibitors;

    var stats = X.stats.map(function (s) {
      return '<div class="kpi"><span class="kpi__k">' + esc(s.k) + '</span><b class="kpi__v">' + esc(s.v) + '</b></div>';
    }).join('');

    var rows = X.rows.map(function (r) {
      var vas = r.vas.length
        ? r.vas.map(function (v) { return '<span class="chip">' + esc(v) + '</span>'; }).join('')
        : '<span class="chip chip--off">未开通</span>';
      return '<tr><td><b>' + esc(r.n) + '</b></td><td class="mono">' + esc(r.booth) + '</td>' +
        '<td>' + esc(r.pkg) + '</td><td class="num mono">' + esc(r.inv) + '</td>' +
        '<td>' + vas + '</td><td>' + pillSt(r.remind ? 'open' : 'end', r.remind ? '已开' : '未开') + '</td></tr>';
    }).join('');

    return '<div class="page">' +
      '<div class="page__head"><h2 class="page__title">参展商</h2>' +
      '<span class="page__note">邀客与增值服务一览</span></div>' +
      '<div class="grid">' +
        '<div class="span-12 kpis kpis--4">' + stats + '</div>' +
        '<div class="card span-12">' + secHead('参展商明细', '邀客三数：触达 / 登记 / 确认到场') +
          '<table class="tbl"><thead><tr><th>品牌</th><th>展位</th><th>套餐</th>' +
          '<th class="num">邀客</th><th>增值包</th><th>到场提醒</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table>' +
          '<p class="note">' + esc(X.note) + '</p>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ---------------------------------------------------------- 订单与分账 */
  function viewFinance() {
    var F = D.finance;

    var rows = F.orders.map(function (r) {
      return '<tr><td class="mono">' + esc(r.no) + '</td><td><b>' + esc(r.item) + '</b></td>' +
        '<td>' + esc(r.who) + '</td><td class="num mono">' + esc(r.amt) + '</td>' +
        '<td>' + pillSt(r.st, r.stTxt) + '</td><td class="mono">' + esc(r.at) + '</td></tr>';
    }).join('');

    var split = F.split.map(function (s) {
      return '<div class="srow"><span>' + esc(s.n) + '</span><span class="srow__r">' + esc(s.r) + '</span><b>' + esc(s.v) + '</b></div>';
    }).join('');

    var settle = F.settle.map(function (s) {
      return '<div class="srow' + (s.hot ? ' srow--sum' : '') + '"><span>' + esc(s.k) + '</span><b>' + esc(s.v) + '</b></div>';
    }).join('');

    return '<div class="page">' +
      '<div class="page__head"><h2 class="page__title">订单与分账</h2>' +
      '<span class="page__note">支付即分账 · 退款自动回退</span></div>' +
      '<div class="grid">' +
        '<div class="card span-8">' + secHead('最近订单', '票、增值包与会员') +
          '<table class="tbl"><thead><tr><th>订单号</th><th>商品</th><th>买家</th>' +
          '<th class="num">金额</th><th>状态</th><th>时间</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table>' +
        '</div>' +
        '<div class="span-4 stack">' +
          '<div class="card">' + secHead('分账规则', '按订单实时拆分') + split + '</div>' +
          '<div class="card">' + secHead('结算', 'T+1 可提现') + settle +
            '<button type="button" class="btn" data-act="withdraw">申请提现</button>' +
          '</div>' +
        '</div>' +
        '<div class="span-12"><p class="note note--wide">' + esc(F.note) + '</p></div>' +
      '</div>' +
    '</div>';
  }

  /* ------------------------------------------------------------ 社群与 AI */
  function viewAI() {
    var A = D.ai;

    var kpis = A.kpis.map(function (s) {
      return '<div class="kpi' + (s.hot ? ' kpi--gold' : '') + '"><span class="kpi__k">' + esc(s.k) + '</span>' +
        '<b class="kpi__v">' + esc(s.v) + '</b></div>';
    }).join('');

    /* 近 7 日双系列柱：请求 vs 实际推理 */
    var max = Math.max.apply(null, A.req);
    var cols = A.days.map(function (d, i) {
      var hq = Math.max(3, Math.round(A.req[i] / max * 100));
      var hr = Math.max(3, Math.round(A.run[i] / max * 100));
      var last = i === A.days.length - 1;
      return '<div class="vday" data-tip="' + esc(d) + ' · 请求 ' + fmt(A.req[i]) + ' · 实际推理 ' + fmt(A.run[i]) + '">' +
        '<div class="vday__bars">' +
          '<i class="vday__req" style="height:' + hq + '%">' + (last ? '<em>' + fmt(A.req[i]) + '</em>' : '') + '</i>' +
          '<i class="vday__run" style="height:' + hr + '%">' + (last ? '<em>' + fmt(A.run[i]) + '</em>' : '') + '</i>' +
        '</div>' +
        '<span class="vday__k">' + esc(d) + '</span></div>';
    }).join('');

    var groups = A.groups.map(function (g) {
      return '<tr><td><b>' + esc(g.n) + '</b></td><td class="mono">' + esc(g.size) + '</td>' +
        '<td>' + pillSt(g.sync === 'wait' ? 'todo' : 'open', g.syncTxt) + '</td>' +
        '<td class="num mono">' + esc(g.msg) + '</td><td class="num mono">' + esc(g.gem) + '</td>' +
        '<td>' + esc(g.plaza) + '</td></tr>';
    }).join('');

    return '<div class="page">' +
      '<div class="page__head"><h2 class="page__title">社群与 AI</h2>' +
      '<span class="page__note">内容供给与算力账</span></div>' +
      '<div class="grid">' +
        '<div class="span-12 kpis kpis--6">' + kpis + '</div>' +

        '<div class="card span-7">' + secHead('请求 vs 实际推理 · 近 7 日', '缓存拉开的差值就是毛利') +
          '<div class="legend">' +
            '<span class="legend__it"><i class="legend__sw legend__sw--req"></i>用户请求</span>' +
            '<span class="legend__it"><i class="legend__sw legend__sw--run"></i>实际推理</span>' +
          '</div>' +
          '<div class="vchart">' + cols + '</div>' +
        '</div>' +

        '<div class="card span-5">' + secHead('群与内容', '只读同步 · 分层开放') +
          '<table class="tbl tbl--tight"><thead><tr><th>群</th><th>规模</th><th>同步</th>' +
          '<th class="num">今日消息</th><th class="num">精华</th><th>社群广场</th></tr></thead>' +
          '<tbody>' + groups + '</tbody></table>' +
        '</div>' +

        '<div class="span-12"><p class="note note--wide">' + esc(A.note) + '</p></div>' +
      '</div>' +
    '</div>';
  }

  /* ------------------------------------------------------------- 演示话术 */
  var showTalk = /[?&]script=1/.test(location.search);

  function renderTalkFab(p) {
    var slot = $('#top-slot');
    slot.innerHTML = (showTalk && D.talk[p])
      ? '<button type="button" class="barbtn" data-act="talk" aria-label="演示话术">话</button>'
      : '';
  }

  function openTalk() {
    var t = D.talk[path()];
    if (!t) return;
    openModal(t.t,
      '<ul class="talk">' + t.p.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      '<div class="talk__q">' + esc(t.q) + '</div>');
  }

  /* ---------------------------------------------------------------- 提示 */
  var tip = $('#tip');
  document.addEventListener('mouseover', function (e) {
    var el = e.target.closest('[data-tip]');
    if (!el) { tip.hidden = true; return; }
    tip.textContent = el.getAttribute('data-tip');
    tip.hidden = false;
  });
  document.addEventListener('mousemove', function (e) {
    if (tip.hidden) return;
    var x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 12);
    tip.style.left = x + 'px';
    tip.style.top = (e.clientY + 16) + 'px';
  });
  document.addEventListener('mouseout', function (e) {
    if (e.target.closest && e.target.closest('[data-tip]')) tip.hidden = true;
  });

  /* ---------------------------------------------------------------- 事件 */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');

    if (act === 'withdraw') { toast('提现申请已提交，T+1 到账（演示）'); }
    else if (act === 'gen') { runGen(el); }
    else if (act === 'recap') { openRecap(); }
    else if (act === 'print') { window.print(); }
    else if (act === 'org') { toast('演示环境仅「盛杰运营方」一个数据域；正式版支持多组织隔离'); }
    else if (act === 'talk') { openTalk(); }
    else if (act === 'reset') { location.hash = '/overview'; location.reload(); }
    else if (act === 'modal-close') { closeModal(); }
  });

  window.addEventListener('hashchange', render);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  if (!location.hash) location.replace('#/overview');
  render();
})();
