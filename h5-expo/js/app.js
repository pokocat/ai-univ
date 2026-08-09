/* 小程序 A · 展会预登记 —— H5 mobile
   纯静态：无后端、无网络请求。状态存 localStorage，与小程序 B（丽人公社）共用前缀。 */
(function () {
  'use strict';

  var D = window.DATA;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ------------------------------------------------------------------ 存储 */
  var NS = 'lrgs:';                     // 两个小程序共用，同源下资料互通
  function load(k, dflt) {
    try { var v = localStorage.getItem(NS + k); return v == null ? dflt : JSON.parse(v); }
    catch (e) { return dflt; }
  }
  function save(k, v) {
    try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) {}
  }

  var state = {
    profile: load('profile', { name: '', phone: '', company: '', identity: '' }),
    cats: load('cats', ['体重管理', '产后修复']),
    pass: load('pass', null),
    signups: load('signups', {}),
    vas: load('vas', {}),
    tasks: load('tasks', {}),
    meetTab: '全部',
    calCity: '全部'
  };

  function registered() { return !!(state.pass && state.pass.code); }

  /* ------------------------------------------------------------------ 工具 */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  function profileComplete() {
    var p = state.profile;
    return !!(p.name.trim() && digits(p.phone).length === 11 && p.identity);
  }

  var toastTimer;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('toast--on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('toast--on'); }, 1900);
  }

  function openSheet(title, html) {
    $('#sheet-title').textContent = title;
    $('#sheet-body').innerHTML = html;
    $('#sheet').hidden = false;
  }
  function closeSheet() { $('#sheet').hidden = true; }

  /* ------------------------------------------------------------------ 路由 */
  var ROUTES = {
    '/home':     { title: '北京美博会', tab: 'expo',   bar: 'dark',  view: viewHome },
    '/register': { title: '观众预登记', tab: 'expo',   bar: 'light', view: viewRegister, mount: mountRegister },
    '/pass':     { title: '电子入场证', tab: 'me',     bar: 'dark',  view: viewPass },
    '/forum':    { title: '同期论坛',   tab: 'agenda', bar: 'light', view: viewForum },
    '/calendar': { title: '活动日历',   tab: 'agenda', bar: 'light', view: viewCalendar },
    '/staff':     { title: '工作人员工作台', tab: '', bar: 'light', view: viewStaff },
    '/welcome':   { title: '现场欢迎屏',     tab: '', bar: 'dark',  view: viewWelcome, mount: mountWelcome },
    '/exhibitor': { title: '参展商工作台',   tab: '', bar: 'light', view: viewExhibitor },
    '/organizer': { title: '主办方看板',     tab: '', bar: 'light', view: viewOrganizer },
    '/checkin':   { title: '现场核销 · 预演', tab: '', bar: 'dark',  view: viewCheckin }
  };
  var TABS = [
    { key: 'expo',   name: '展会', to: '/home' },
    { key: 'agenda', name: '日程', to: '/calendar' },
    { key: 'me',     name: '我的', to: '/pass' }
  ];

  /* 底部 tab 图标 · 24×24 线性图标，跟随 currentColor */
  var ICONS = {
    expo:   '<path d="M3.6 9.3 5.2 4.6h13.6l1.6 4.7"/><path d="M5.3 9.3v10.1h13.4V9.3"/><path d="M9.4 19.4v-5.5h5.2v5.5"/>',
    agenda: '<rect x="3.6" y="5.2" width="16.8" height="14.6" rx="2.6"/><path d="M3.6 9.7h16.8M8.2 3.5v3.4M15.8 3.5v3.4"/>',
    me:     '<circle cx="12" cy="8.2" r="3.4"/><path d="M4.9 19.8c0-3.6 3.2-5.7 7.1-5.7s7.1 2.1 7.1 5.7"/>'
  };
  function icon(k) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[k] || '') + '</svg>';
  }

  var depth = 0;                    // 本会话内的前进次数，决定返回键行为

  function path() {
    var h = location.hash.replace(/^#/, '');
    return ROUTES[h] ? h : '/home';
  }
  function go(to) {
    if (to === path()) return;
    depth++;
    location.hash = to;
  }
  function back() {
    if (depth > 0) { depth--; history.back(); }
    else { location.replace('#/home'); render(); }
  }

  /* ------------------------------------------------------------------ 渲染 */
  function render() {
    var p = path(), r = ROUTES[p];

    if (p !== '/welcome' && welTimer) { clearInterval(welTimer); welTimer = null; }

    var bar = $('#appbar');
    bar.classList.toggle('appbar--dark', r.bar === 'dark');
    $('#appbar-title').textContent = r.title;
    $('#back').hidden = (p === '/home');

    var view = $('#view');
    view.innerHTML = r.view();
    view.scrollTop = 0;
    if (r.mount) r.mount(view);

    $('#tabbar').innerHTML = TABS.map(function (t) {
      var on = t.key === r.tab;
      return '<button type="button" class="tab' + (on ? ' tab--on' : '') +
        '" data-act="go" data-to="' + t.to + '"' + (on ? ' aria-current="page"' : '') +
        '>' + icon(t.key) + '<span>' + t.name + '</span></button>';
    }).join('');

    renderTalkFab(p);
    document.title = r.title + ' · 第34届北京国际美博会';
  }

  /* ------------------------------------------------------------- A1 展会首页 */
  function viewHome() {
    var done = registered();
    return '' +
      '<section class="hero">' +
        '<div class="hero__bg" role="presentation"></div>' +
        '<div class="hero__scrim" role="presentation"></div>' +
        '<div class="hero__in">' +
          '<div class="hero__eyebrow">CIBE 北京站 · 第 34 届</div>' +
          '<h2 class="hero__h1">北京国际美博会</h2>' +
          '<p class="hero__sub">2026 年 10 月 10—12 日 · 北京国际会议中心<br>同期举办 2026 减肥产业大会</p>' +
        '</div>' +
      '</section>' +

      '<div class="stats">' + D.expoStats.map(function (s) {
        return '<div class="stat"><b>' + esc(s.v) + '</b><span>' + esc(s.k) + '</span></div>';
      }).join('') + '</div>' +

      '<section class="sec">' +
        '<div class="sec__head"><h3 class="sec__title">观众预登记</h3><span class="sec__note">约 40 秒完成</span></div>' +
        '<div class="card benefits">' + D.benefits.map(function (b) {
          return '<div class="benefit"><span class="benefit__n">' + esc(b.n) + '</span>' +
            '<div><div class="benefit__t">' + esc(b.t) + '</div>' +
            '<div class="benefit__d">' + esc(b.d) + '</div></div></div>';
        }).join('') + '</div>' +
      '</section>' +

      '<div class="pad stack g10">' +
        (done
          ? '<button type="button" class="btn btn--primary" data-act="go" data-to="/pass">查看我的电子入场证</button>'
          : '<button type="button" class="btn btn--primary" data-act="go" data-to="/register">立即预登记 · 领电子入场证</button>') +
        '<button type="button" class="btn btn--ghost" data-act="go" data-to="/forum">同期论坛 · 闭门会报名</button>' +
      '</div>' +

      '<section class="sec" style="padding-bottom:20px">' +
        '<div class="sec__head"><h3 class="sec__title">分身份工作台</h3><span class="sec__note">演示入口</span></div>' +
        '<div class="entries">' +
          '<button type="button" class="entry" data-act="go" data-to="/exhibitor">' +
            '<span class="entry__t">参展商工作台</span>' +
            '<span class="entry__d">邀客追踪 · 到场提醒 · 增值服务</span></button>' +
          '<button type="button" class="entry" data-act="go" data-to="/organizer">' +
            '<span class="entry__t">主办方看板</span>' +
            '<span class="entry__d">到账 · 渠道排行 · 分账提现</span></button>' +
          '<button type="button" class="entry" data-act="go" data-to="/staff">' +
            '<span class="entry__t">工作人员工作台</span>' +
            '<span class="entry__d">每日任务 · 素材 · 邀约排行</span></button>' +
          '<button type="button" class="entry" data-act="go" data-to="/welcome">' +
            '<span class="entry__t">现场欢迎屏</span>' +
            '<span class="entry__d">到场滚动欢迎 · 实时人数</span></button>' +
        '</div>' +
      '</section>';
  }

  /* ------------------------------------------------------------- A2 预登记 */
  var FIELDS = [
    { key: 'name',     label: '姓名',            ph: '请输入真实姓名',   type: 'text',  mode: 'text' },
    { key: 'phone',    label: '手机号',          ph: '用于入场核验',     type: 'tel',   mode: 'numeric' },
    { key: 'company',  label: '企业 / 门店名称', ph: '请输入',           type: 'text',  mode: 'text' },
    { key: 'identity', label: '身份类别',        ph: '请选择',           type: 'select' }
  ];

  function viewRegister() {
    var p = state.profile;

    var fields = FIELDS.map(function (f) {
      var v = p[f.key] || '';
      var on = v ? ' field--on' : '';
      if (f.type === 'select') {
        return '<label class="field field--sel' + on + '">' +
          '<span class="field__label">' + esc(f.label) + '</span>' +
          '<select data-field="identity" required>' +
            '<option value="" disabled' + (v ? '' : ' selected') + '>' + esc(f.ph) + '</option>' +
            D.identities.map(function (o) {
              return '<option value="' + esc(o) + '"' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>';
            }).join('') +
          '</select></label>';
      }
      return '<label class="field' + on + '">' +
        '<span class="field__label">' + esc(f.label) + '</span>' +
        '<input type="' + f.type + '" data-field="' + f.key + '" value="' + esc(v) + '"' +
          ' placeholder="' + esc(f.ph) + '" inputmode="' + (f.mode || 'text') + '"' +
          (f.key === 'phone' ? ' maxlength="11"' : ' maxlength="30"') +
          ' autocomplete="off"></label>';
    }).join('');

    var chips = D.categories.map(function (c) {
      var on = state.cats.indexOf(c) > -1;
      return '<button type="button" class="chip' + (on ? ' chip--on' : '') +
        '" data-act="cat" data-cat="' + esc(c) + '" aria-pressed="' + on + '">' + esc(c) + '</button>';
    }).join('');

    return '' +
      '<div class="pad stack g16">' +
        '<div class="stack g6">' +
          '<h2 class="serif" style="font-size:19px">专业观众登记</h2>' +
          '<p class="note">信息仅用于入场核验与同期会议邀约</p>' +
        '</div>' +

        '<div class="stack g10">' + fields + '</div>' +

        '<div class="stack g8">' +
          '<span class="label">关注品类 · 多选</span>' +
          '<div class="chips" id="cats">' + chips + '</div>' +
        '</div>' +

        '<div class="notice"><i></i><p>登记完成后可一键进入 <b>丽人公社 · AI 学习社群</b>，由 AI 军师按您的品类推荐展商与同期论坛。</p></div>' +

        '<button type="button" class="btn" id="submit" data-act="submit"></button>' +
        '<p class="disclaimer">演示环境，数据仅保存在本机浏览器，不会上传。</p>' +
      '</div>';
  }

  function mountRegister(root) {
    $$('[data-field]', root).forEach(function (el) {
      el.addEventListener('input', function () {
        var k = el.getAttribute('data-field');
        var v = el.value;
        if (k === 'phone') { v = digits(v).slice(0, 11); el.value = v; }
        state.profile[k] = v;
        save('profile', state.profile);
        el.closest('.field').classList.toggle('field--on', !!v);
        syncSubmit();
      });
      el.addEventListener('change', function () {
        state.profile[el.getAttribute('data-field')] = el.value;
        save('profile', state.profile);
        el.closest('.field').classList.toggle('field--on', !!el.value);
        syncSubmit();
      });
    });
    syncSubmit();
  }

  function syncSubmit() {
    var btn = $('#submit');
    if (!btn) return;
    var ok = profileComplete();
    btn.textContent = ok ? '提交登记' : '一键带入微信资料';
    btn.className = 'btn ' + (ok ? 'btn--primary' : 'btn--dark');
  }

  function fillDemo() {
    state.profile = {
      name: D.demoProfile.name, phone: D.demoProfile.phone,
      company: D.demoProfile.company, identity: D.demoProfile.identity
    };
    save('profile', state.profile);
    var view = $('#view');
    view.innerHTML = viewRegister();
    mountRegister(view);
    toast('已带入微信资料，可直接提交');
  }

  function submitReg() {
    if (!profileComplete()) { fillDemo(); return; }
    if (!state.cats.length) { toast('请至少选择一个关注品类'); return; }
    var tail = digits(state.profile.phone).slice(-6) || String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
    state.pass = { code: 'BBE34-2026-' + tail, at: Date.now() };
    save('pass', state.pass);
    go('/pass');
  }

  /* ------------------------------------------------------------- A3 入场证 */
  function viewPass() {
    if (!registered()) {
      return '<div class="pass pass--empty">' +
          '<div class="pass__ok">' +
            '<div class="pass__tick pass__tick--idle"><i></i></div>' +
            '<h2>还没有电子入场证</h2>' +
            '<p>完成观众预登记后，这里会生成您的入场二维码</p>' +
          '</div>' +
          '<div class="ticket ticket--ghost">' +
            '<div class="qr-ghost">' + new Array(10).join('<span></span>') + '</div>' +
            '<p>三天展期任一入口闸机通行<br>凭码入场，无需排队换证</p>' +
          '</div>' +
          '<div class="stack g10" style="margin-top:auto">' +
            '<button type="button" class="btn" style="background:var(--acc-warm);color:#fff" data-act="go" data-to="/register">去预登记 · 约 40 秒</button>' +
            '<button type="button" class="btn btn--onDark" data-act="go" data-to="/forum">先看同期论坛</button>' +
          '</div>' +
        '</div>';
    }
    var p = state.profile;
    var rows = [
      { k: '姓名', v: p.name || '—' },
      { k: '企业', v: p.company || '—' },
      { k: '身份', v: p.identity || '—' },
      { k: '有效期', v: '10.10 – 10.12' }
    ];
    var catLine = state.cats.length ? state.cats.slice(0, 2).join(' / ') : '全品类';

    return '' +
      '<div class="pass">' +
        '<div class="pass__ok">' +
          '<div class="pass__tick"><i></i></div>' +
          '<h2>登记成功</h2>' +
          '<p>凭此证于任一入口闸机扫码入场</p>' +
        '</div>' +

        '<div class="ticket">' +
          '<div class="ticket__top">' +
            '<div><div class="ticket__kind">VISITOR PASS</div><div class="ticket__name">第34届北京国际美博会</div></div>' +
            '<span class="ticket__badge">专业观众</span>' +
          '</div>' +
          '<div class="ticket__qr">' +
            '<img class="qr" src="assets/qr.svg" alt="入场二维码（示意图）">' +
            '<div class="ticket__code">' + esc(state.pass.code) + '</div>' +
          '</div>' +
          '<div class="ticket__rows">' + rows.map(function (r) {
            return '<div><span>' + esc(r.k) + '</span><b>' + esc(r.v) + '</b></div>';
          }).join('') + '</div>' +
        '</div>' +

        '<div class="strip">' +
          '<div class="strip__av">军</div>' +
          '<div><div class="strip__t">AI 军师已为您建档</div>' +
          '<div class="strip__d">按' + esc(catLine) + '品类匹配展商与 2 场同期论坛</div></div>' +
        '</div>' +

        '<div class="stack g10" style="margin-top:auto;padding-top:6px">' +
          '<a class="btn" style="background:var(--acc-warm);color:#fff" href="' + esc(crossUrl(D.lirenUrl, '/messages')) + '">进入丽人公社 · AI 学习社群</a>' +
          '<button type="button" class="btn btn--onDark" data-act="go" data-to="/forum">先看同期论坛</button>' +
        '</div>' +
      '</div>';
  }

  /* ------------------------------------------------------------- A4 同期论坛 */
  function viewForum() {
    var pills = D.meetTabs.map(function (n) {
      return '<button type="button" class="pill' + (state.meetTab === n ? ' pill--on' : '') +
        '" data-act="meettab" data-tab="' + esc(n) + '">' + esc(n) + '</button>';
    }).join('');

    var list = D.meetings.filter(function (m) {
      return state.meetTab === '全部' || m.cat === state.meetTab;
    });

    var cards = list.length ? list.map(function (m) {
      var st = state.signups[m.id];
      var seat = m.seat, seatOff = !m.open;
      if (st && m.id === 'closed') seat = (m.left - 1) + ' / ' + m.total + ' · 审核中';

      var btnTxt = m.btn, btnCls = 'meet__btn';
      if (!m.open) { btnCls += ' meet__btn--off'; }
      else if (st) { btnTxt = m.review ? '审核中' : '已报名'; btnCls += ' meet__btn--done'; }

      return '<div class="card meet">' +
          '<div class="meet__head">' +
            (m.thumb ? '<img class="meet__thumb" src="' + esc(m.thumb) + '" alt="" loading="lazy">' : '') +
            '<div class="meet__headTxt">' +
              '<div class="meet__tags">' +
                '<span class="tag' + (m.tag === '闭门会' ? ' tag--closed' : '') + '">' + esc(m.tag) + '</span>' +
                '<span class="meet__time">' + esc(m.time) + '</span>' +
              '</div>' +
              '<h3 class="meet__title">' + esc(m.title) + '</h3>' +
            '</div>' +
          '</div>' +
          '<p class="meet__desc">' + esc(m.desc) + '</p>' +
          '<div class="meet__foot">' +
            '<div class="meet__seat' + (seatOff ? ' meet__seat--off' : '') + '">' +
              '<span>' + esc(m.seatLabel) + '</span><b>' + esc(seat) + '</b></div>' +
            '<button type="button" class="' + btnCls + '" data-act="signup" data-id="' + esc(m.id) + '"' +
              (m.open && !st ? '' : ' disabled') + '>' + esc(btnTxt) + '</button>' +
          '</div>' +
        '</div>';
    }).join('') : '<div class="empty">该分类下暂无已公布的日程。</div>';

    return '<div class="pad stack g12">' + '<div class="pills">' + pills + '</div>' + cards +
      '<p class="disclaimer">同期论坛安排以组委会正式日程为准，本页为演示排布。</p></div>';
  }

  function signup(id) {
    var m = D.meetings.filter(function (x) { return x.id === id; })[0];
    if (!m || !m.open) return;
    if (!registered()) { toast('请先完成观众预登记'); go('/register'); return; }
    state.signups[id] = m.review ? 'review' : 'signed';
    save('signups', state.signups);
    render();
    toast(m.review ? '已提交申请，组委会审核后短信通知' : '报名成功，行程已加入我的日程');
  }

  /* ------------------------------------------------------- A8 活动日历 */
  var KIND = {
    expo:    { n: '大展',   cls: 'expo' },
    forum:   { n: '论坛',   cls: 'forum' },
    closed:  { n: '闭门会', cls: 'closed' },
    live:    { n: '线上',   cls: 'live' },
    offline: { n: '城市站', cls: 'offline' }
  };

  function viewCalendar() {
    var pills = D.calendarCities.map(function (c) {
      return '<button type="button" class="pill' + (state.calCity === c ? ' pill--on' : '') +
        '" data-act="calcity" data-city="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');

    var months = D.calendar.map(function (mo) {
      var items = mo.items.filter(function (it) {
        return state.calCity === '全部' || it.city === state.calCity;
      });
      if (!items.length) return '';

      var rows = items.map(function (it) {
        var k = KIND[it.kind] || KIND.offline;
        var soon = it.st === 'soon';
        return '<button type="button" class="cal' + (it.st === 'main' ? ' cal--main' : '') +
            (soon ? ' cal--soon' : '') + '" data-act="calgo" data-st="' + it.st + '">' +
            '<span class="cal__date"><b>' + esc(it.d.split('.')[1]) + '</b><em>' + esc(it.w) + '</em></span>' +
            '<span class="cal__body">' +
              '<span class="cal__tags"><span class="ktag ktag--' + k.cls + '">' + k.n + '</span>' +
              '<span class="cal__city">' + esc(it.city) + '</span></span>' +
              '<span class="cal__t">' + esc(it.t) + '</span>' +
              '<span class="cal__note">' + esc(it.note) + '</span>' +
            '</span>' +
            '<span class="cal__go' + (it.st === 'few' ? ' cal__go--few' : '') + '">' +
              (soon ? '待开放' : (it.st === 'few' ? '限席位' : '报名')) + '</span>' +
          '</button>';
      }).join('');

      return '<div class="stack g8"><div class="calmo"><b>' + esc(mo.m) + '</b><span></span></div>' + rows + '</div>';
    }).join('');

    return '<div class="pad stack g14">' +
      '<div class="pills">' + pills + '</div>' +
      (months || '<div class="empty">该城市暂无已公布的活动。</div>') +
      '<p class="disclaimer">一年多期、全国巡回，报名后自动进入对应社群并打上活动标签。日程为演示排布，以组委会正式公布为准。</p>' +
    '</div>';
  }

  /* ------------------------------------------------------- A9 工作人员工作台 */
  function viewStaff() {
    var S = D.staff;

    var stats = S.my.map(function (s) {
      return '<div class="stat"><b>' + esc(String(s.v)) + '</b><span>' + esc(s.k) + '</span></div>';
    }).join('');

    var done = S.tasks.filter(function (t) { return state.tasks[t.id] != null ? state.tasks[t.id] : t.done; }).length;

    var tasks = S.tasks.map(function (t) {
      var on = state.tasks[t.id] != null ? state.tasks[t.id] : t.done;
      return '<button type="button" class="task' + (on ? ' task--on' : '') + '" data-act="task" data-id="' + t.id + '">' +
        '<span class="task__box"><i></i></span>' +
        '<span class="task__t">' + esc(t.t) + '</span>' +
        '<span class="task__tag">' + esc(t.tag) + '</span></button>';
    }).join('');

    var copies = S.copies.map(function (c, i) {
      return '<div class="copy"><div class="copy__head"><span class="copy__tag">' + esc(c.tag) + '</span>' +
        '<button type="button" class="copy__btn" data-act="copytxt" data-i="' + i + '">复制</button></div>' +
        '<p class="copy__txt">' + esc(c.txt) + '</p></div>';
    }).join('');

    var max = S.board.reduce(function (m, b) { return Math.max(m, b.v); }, 1);
    var board = S.board.map(function (b, i) {
      var w = Math.max(8, Math.round(b.v / max * 100));
      return '<div class="brow' + (b.me ? ' brow--me' : '') + '">' +
        '<em>' + (i + 1) + '</em><span class="brow__n">' + esc(b.n) + '</span>' +
        '<span class="brow__bar"><i style="width:' + w + '%"></i></span>' +
        '<b>' + b.v + '</b></div>';
    }).join('');

    return '<div class="pad stack g14">' +
      '<div class="card staffcard">' +
        '<div class="staffcard__row">' +
          '<div><div class="eyebrow">STAFF</div>' +
          '<div class="staffcard__n serif">' + esc(S.me.name) + ' · ' + esc(S.me.role) + '</div>' +
          '<div class="staffcard__c">专属推广码 ' + esc(S.me.code) + '</div></div>' +
          '<div class="staffcard__d"><b>' + daysToExpo() + '</b><span>天后开展</span></div>' +
        '</div>' +
        '<div class="stats stats--flat">' + stats + '</div>' +
      '</div>' +

      '<section class="stack g8">' +
        '<div class="sec__head"><h3 class="sec__title">今日任务</h3>' +
        '<span class="sec__note">' + done + ' / ' + S.tasks.length + ' 已完成</span></div>' +
        '<div class="card" style="padding:5px 14px">' + tasks + '</div>' +
      '</section>' +

      '<section class="stack g8">' +
        '<div class="sec__head"><h3 class="sec__title">今日素材</h3><span class="sec__note">每天自动更新</span></div>' +
        '<div class="stack g8">' + copies + '</div>' +
        '<button type="button" class="btn btn--ghost" data-act="poster">生成我的专属邀请海报</button>' +
      '</section>' +

      '<section class="stack g8">' +
        '<div class="sec__head"><h3 class="sec__title">邀约龙虎榜</h3><span class="sec__note">本周 · 按登记数</span></div>' +
        '<div class="card" style="padding:13px 15px">' + board + '</div>' +
      '</section>' +

      '<p class="disclaimer">任务、素材与排行为演示数据；正式版由运营后台按活动阶段统一下发。</p>' +
    '</div>';
  }

  /* ------------------------------------------------------- A10 现场欢迎屏 */
  var welTimer = null, welIdx = 0, welCount = 0;

  function welcomeCardHTML(p) {
    return '<div class="wel__card">' +
      '<div class="wel__hi">欢迎</div>' +
      '<div class="wel__n">' + esc(p.n) + '</div>' +
      '<div class="wel__c">' + esc(p.c) + '</div>' +
      '<div class="wel__from">' + esc(p.from) + '</div></div>';
  }

  function viewWelcome() {
    welCount = D.welcome.base;
    return '<div class="wel">' +
      '<div class="wel__top">' +
        '<div><div class="wel__eyebrow">第34届北京国际美博会 · 2 号馆</div>' +
        '<div class="wel__title serif">欢迎莅临</div></div>' +
        '<div class="wel__count"><b id="wel-n">' + fmtN(welCount) + '</b><span>今日已入场</span></div>' +
      '</div>' +
      '<div class="wel__stage" id="wel-stage">' + welcomeCardHTML(D.welcome.queue[0]) + '</div>' +
      '<div class="wel__foot">' +
        '<span class="wel__live"><i></i>实时核销中</span>' +
        '<button type="button" class="wel__btn" data-act="go" data-to="/checkin">去核销台</button>' +
      '</div>' +
    '</div>';
  }

  function fmtN(n) { return n.toLocaleString('zh-Hans-CN'); }

  function mountWelcome() {
    clearInterval(welTimer);
    welIdx = 0;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    welTimer = setInterval(function () {
      var stage = $('#wel-stage');
      if (!stage) { clearInterval(welTimer); welTimer = null; return; }
      welIdx = (welIdx + 1) % D.welcome.queue.length;
      welCount++;
      stage.innerHTML = welcomeCardHTML(D.welcome.queue[welIdx]);
      var n = $('#wel-n');
      if (n) { n.textContent = fmtN(welCount); n.classList.remove('wel__n--tick'); void n.offsetWidth; n.classList.add('wel__n--tick'); }
    }, 3200);
  }

  /* ------------------------------------------------------- A5 参展商工作台 */
  function daysToExpo() {
    var d = Math.ceil((new Date(2026, 9, 10) - new Date()) / 864e5);
    return d > 0 ? d : 0;
  }

  function viewExhibitor() {
    var E = D.exhibitor;
    var max = E.funnel[0].v;

    var funnel = E.funnel.map(function (f) {
      var w = Math.max(6, Math.round(f.v / max * 100));
      return '<div class="frow"><span class="frow__k">' + esc(f.k) + '</span>' +
        '<span class="frow__bar"><i style="width:' + w + '%"></i></span>' +
        '<b class="frow__v">' + f.v + '</b></div>';
    }).join('');

    var invitees = E.invitees.map(function (p) {
      return '<div class="irow"><span class="irow__dot irow__dot--' + p.s + '"></span>' +
        '<div class="irow__txt"><div class="irow__n">' + esc(p.n) +
        ' <span class="irow__tag irow__tag--' + p.s + '">' + esc(p.tag) + '</span></div>' +
        '<div class="irow__d">' + esc(p.d) + '</div></div></div>';
    }).join('');

    var vas = E.vas.map(function (v) {
      var got = !!state.vas[v.id];
      return '<div class="vas card">' +
        '<div class="vas__head"><div class="vas__t">' + esc(v.t) + '</div><b class="vas__p">' + esc(v.p) + '</b></div>' +
        '<p class="vas__d">' + esc(v.d) + '</p>' +
        '<button type="button" class="btn btn--sm ' + (got ? 'vas__btn--done' : 'btn--primary') +
        '" data-act="buy" data-id="' + v.id + '"' + (got ? ' disabled' : '') + '>' +
        (got ? '已开通' : '开通') + '</button></div>';
    }).join('');

    return '<div class="pad stack g12">' +
      '<div class="card booth">' +
        '<div class="booth__row"><div><div class="eyebrow">EXHIBITOR</div>' +
        '<div class="booth__brand serif">' + esc(E.brand) + '</div>' +
        '<div class="booth__meta">' + esc(E.hall) + ' · ' + esc(E.pkg) + '</div></div>' +
        '<div class="booth__no"><span>展位</span><b>' + esc(E.booth) + '</b></div></div>' +
        '<div class="booth__count">距开展还有 <b>' + daysToExpo() + '</b> 天 · 今日邀客素材已更新</div>' +
      '</div>' +

      '<div class="card linkcard">' +
        '<div class="linkcard__label">专属邀请链接 · 一展商一码</div>' +
        '<div class="linkcard__url">' + esc(E.link) + '</div>' +
        '<div class="linkcard__btns">' +
          '<button type="button" class="btn btn--sm btn--ghost" data-act="copylink">复制链接</button>' +
          '<button type="button" class="btn btn--sm btn--primary" data-act="poster">生成今日邀客海报</button>' +
        '</div>' +
      '</div>' +

      '<div class="tools">' +
        '<button type="button" class="tool" data-act="vscript">' +
          '<span class="tool__ico tool__ico--v"></span>' +
          '<span class="tool__t">30 秒口播脚本</span>' +
          '<span class="tool__d">分镜 + 提词，照着念</span></button>' +
        '<button type="button" class="tool" data-act="celeb">' +
          '<span class="tool__ico tool__ico--s"></span>' +
          '<span class="tool__t">嘉宾祝贺视频</span>' +
          '<span class="tool__d">拍同款 · 按次授权</span></button>' +
      '</div>' +

      '<section class="stack g8"><div class="sec__head"><h3 class="sec__title">邀客漏斗</h3><span class="sec__note">实时 · 演示数据</span></div>' +
        '<div class="card" style="padding:15px 15px 12px">' + funnel + '</div></section>' +

      '<section class="stack g8"><div class="sec__head"><h3 class="sec__title">受邀客户</h3><span class="sec__note">到场提醒 ' + (state.vas.track ? '已开通' : '未开通') + '</span></div>' +
        '<div class="card" style="padding:3px 15px">' + invitees + '</div></section>' +

      '<section class="stack g8"><div class="sec__head"><h3 class="sec__title">增值服务</h3><span class="sec__note">按场开通 · 展期内有效</span></div>' +
        vas + '</section>' +

      '<p class="disclaimer">漏斗、客户与报价均为演示排布，正式权益与价格以组委会及平台协议为准。</p>' +
    '</div>';
  }

  /* AI 邀客海报（弹层） */
  var poster = { size: 'story', copy: 0 };
  var POSTER_SIZES = [
    { id: 'story', n: '朋友圈 3:4' },
    { id: 'roll',  n: '易拉宝 9:16' },
    { id: 'wide',  n: '横版屏幕 16:9' }
  ];

  function openPoster() {
    var E = D.exhibitor;
    var pills = POSTER_SIZES.map(function (s) {
      return '<button type="button" class="pill' + (poster.size === s.id ? ' pill--on' : '') +
        '" data-act="psize" data-size="' + s.id + '">' + s.n + '</button>';
    }).join('');
    openSheet('AI 邀客海报 · 今日版',
      '<div class="stack g12">' +
        '<div class="poster poster--' + poster.size + '">' +
          '<div class="poster__scrim"></div>' +
          '<div class="poster__in">' +
            '<div class="poster__eyebrow">第34届北京国际美博会 · 10.10–12</div>' +
            '<div class="poster__brand">' + esc(E.brand) + '</div>' +
            '<div class="poster__line">' + esc(E.hall) + ' · ' + esc(E.booth) + ' 展位</div>' +
            '<div class="poster__copy">' + esc(E.posterCopy[poster.copy]) + '</div>' +
            '<div class="poster__foot"><img src="assets/qr.svg" alt=""><span>扫码预登记 · 电子证入场</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="pills">' + pills + '</div>' +
        '<div class="rowbtns">' +
          '<button type="button" class="btn btn--sm btn--ghost" data-act="pcopy">换一版文案</button>' +
          '<button type="button" class="btn btn--sm btn--dark" data-act="pcopytext">复制文案</button>' +
        '</div>' +
        '<p class="note">读取报名时的品牌与展位信息，按展会规格自动生成，同一主题每天不同表达（本地样稿演示）。</p>' +
      '</div>');
  }

  /* 30 秒口播脚本 */
  function openScript() {
    var V = D.exhibitor.videoScript;
    openSheet(V.title,
      '<div class="stack g10">' +
        '<p class="note">' + esc(V.meta) + '</p>' +
        '<div class="stack g8">' + V.lines.map(function (l) {
          return '<div class="shot"><div class="shot__head"><span class="shot__t">' + esc(l.t) + '</span>' +
            '<span class="shot__s">' + esc(l.s) + '</span></div>' +
            '<p class="shot__txt">' + esc(l.txt) + '</p></div>';
        }).join('') + '</div>' +
        '<div class="notice"><i></i><p>' + esc(V.tips) + '</p></div>' +
        '<button type="button" class="btn btn--dark" data-act="copyscript">复制全文到提词器</button>' +
      '</div>');
  }

  /* 嘉宾祝贺视频 · 拍同款 */
  function openCeleb() {
    openSheet('嘉宾祝贺视频 · 拍同款',
      '<div class="stack g10">' +
        D.exhibitor.celeb.map(function (c) {
          return '<div class="celeb' + (c.off ? ' celeb--off' : '') + '">' +
            '<div class="celeb__head"><div><b>' + esc(c.name) + '</b>' +
            '<span class="celeb__meta">' + esc(c.dur) + ' · ' + esc(c.auth) + '</span></div>' +
            '<b class="celeb__p">' + esc(c.price) + '</b></div>' +
            '<p class="celeb__line">「' + esc(c.line) + '」</p>' +
            '<button type="button" class="btn btn--sm ' + (c.off ? 'celeb__btn--off' : 'btn--primary') + '"' +
              (c.off ? ' disabled' : ' data-act="celeb-make" data-id="' + esc(c.id) + '"') + '>' +
              (c.off ? '授权待签署' : '生成本条') + '</button>' +
          '</div>';
        }).join('') +
        '<p class="disclaimer">所有肖像、声音与数字人素材均须绑定授权合同，记录使用渠道、次数与有效期；未授权不得生成，过期自动停用。</p>' +
      '</div>');
  }

  /* ------------------------------------------------------- A6 主办方看板 */
  function viewOrganizer() {
    var O = D.organizer;

    var kpis = O.stats.map(function (s) {
      return '<div class="kpi' + (s.hot ? ' kpi--hot' : '') + '"><b>' + esc(s.v) + '</b><span>' + esc(s.k) + '</span></div>';
    }).join('');

    var orders = O.orders.map(function (o) {
      return '<div class="orow"><div class="orow__txt"><div class="orow__t">' + esc(o.t) + '</div>' +
        '<div class="orow__d">' + esc(o.who) + ' · ' + esc(o.at) + '</div></div>' +
        '<b class="orow__amt">' + esc(o.amt) + '</b></div>';
    }).join('');

    var maxc = O.channels.reduce(function (m, c) { return Math.max(m, c.v); }, 1);
    var channels = O.channels.map(function (c) {
      var w = Math.max(6, Math.round(c.v / maxc * 100));
      return '<div class="frow"><span class="frow__k frow__k--wide">' + esc(c.n) + '</span>' +
        '<span class="frow__bar"><i style="width:' + w + '%"></i></span>' +
        '<b class="frow__v">' + c.v + '</b></div>';
    }).join('');

    var split = O.split.map(function (s) {
      return '<div class="srow"><span>' + esc(s.n) + '</span><span class="srow__r">' + esc(s.r) + '</span><b>' + esc(s.v) + '</b></div>';
    }).join('');

    var TS = { done: '已完成', doing: '进行中', todo: '待处理' };
    var tasks = O.tasks.map(function (t) {
      return '<div class="trow"><span class="trow__s trow__s--' + t.s + '">' + TS[t.s] + '</span>' +
        '<span class="trow__t">' + esc(t.t) + '</span></div>';
    }).join('');

    return '<div class="pad stack g12">' +
      '<div class="scene">招商期 · 距开展 ' + daysToExpo() + ' 天 · 演示数据</div>' +
      '<div class="kpis">' + kpis + '</div>' +

      '<section class="stack g8"><div class="sec__head"><h3 class="sec__title">最近到账</h3><span class="sec__note">增值服务订单</span></div>' +
        '<div class="card" style="padding:3px 15px">' + orders + '</div></section>' +

      '<section class="stack g8"><div class="sec__head"><h3 class="sec__title">渠道排行</h3><span class="sec__note">预登记来源 · 一人一码</span></div>' +
        '<div class="card" style="padding:15px 15px 12px">' + channels + '</div></section>' +

      '<section class="stack g8"><div class="sec__head"><h3 class="sec__title">今日分账</h3><span class="sec__note">支付时自动拆分</span></div>' +
        '<div class="card" style="padding:3px 15px 14px">' + split +
          '<div class="srow srow--sum"><span>我的可提现余额</span><b>' + esc(O.balance) + '</b></div>' +
          '<button type="button" class="btn btn--sm btn--dark" data-act="withdraw" style="margin-top:8px">申请提现</button>' +
        '</div></section>' +

      '<section class="stack g8"><div class="sec__head"><h3 class="sec__title">今日运营任务</h3><span class="sec__note">素材已备好</span></div>' +
        '<div class="card" style="padding:3px 15px">' + tasks + '</div></section>' +

      '<button type="button" class="btn btn--ghost" data-act="go" data-to="/checkin">现场核销 · 预演</button>' +
      '<p class="disclaimer">所有金额、渠道与任务均为演示数据；分账比例以正式协议配置为准，退款自动回退。</p>' +
    '</div>';
  }

  /* ------------------------------------------------------- A7 现场核销 */
  var scanN = 0, scanBusy = false, scanLastAt = '';

  function viewCheckin() {
    return '<div class="scan">' +
      '<div class="scan__stats">' +
        '<div class="scan__stat"><b id="scan-count">' + scanN + '</b><span>本机已核销</span></div>' +
        '<div class="scan__stat"><b>12</b><span>现场新登记</span></div>' +
        '<div class="scan__stat"><b>0</b><span>异常票</span></div>' +
      '</div>' +
      '<button type="button" class="scanpad" id="scanpad" data-act="scan"><i></i><span>扫码核验</span></button>' +
      '<div class="scan__result" id="scan-result">' +
        '<p class="scan__hint">对准观众电子入场证上的二维码<br>核销成功后自动通知对应展商</p></div>' +
      '<div class="stack g10" style="margin-top:auto">' +
        '<button type="button" class="btn btn--onDark" data-act="manual">手工补签 · 按手机号检索</button>' +
      '</div>' +
    '</div>';
  }

  function doScan() {
    if (scanBusy) return;
    scanBusy = true;
    var pad = $('#scanpad');
    pad.classList.add('scanpad--busy');
    $('#scan-result').innerHTML = '<p class="scan__hint">识别中…</p>';

    setTimeout(function () {
      scanBusy = false;
      pad.classList.remove('scanpad--busy');
      var res = $('#scan-result');
      var p = registered() ? state.profile : D.demoProfile;
      var code = registered() ? state.pass.code : 'BBE34-2026-006207';
      var now = new Date();
      var hh = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);

      if (scanLastAt) {
        res.innerHTML = '<div class="scanCard scanCard--warn">' +
          '<div class="scanCard__badge">重复扫码</div>' +
          '<div class="scanCard__n">' + esc(p.name || '观众') + ' · ' + esc(code) + '</div>' +
          '<div class="scanCard__d">该证已于 ' + scanLastAt + ' 首次入场，请勿重复核销</div></div>';
        toast('已拦截：该证今日已入场');
        scanLastAt = '';
        return;
      }

      scanN++;
      scanLastAt = hh;
      var cnt = $('#scan-count');
      if (cnt) cnt.textContent = scanN;
      res.innerHTML = '<div class="scanCard">' +
        '<div class="scanCard__badge scanCard__badge--ok">核销成功 · ' + hh + '</div>' +
        '<div class="scanCard__n">' + esc(p.name || '观众') + ' · ' + esc(p.identity || '专业观众') + '</div>' +
        '<div class="scanCard__d">' + esc(p.company || '') + (p.company ? ' · ' : '') + esc(code) + '</div></div>';
      toast('已通知展商 E12：受邀客户已到场');
    }, 900);
  }

  function copyText(t) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = t;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      toast('已复制');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { toast('已复制'); }, fallback);
    } else fallback();
  }

  /* ------------------------------------------------------------- 演示话术 */
  var showTalk = /[?&]script=1/.test(location.search);

  /* 跳到另一个小程序时，把演示话术开关带过去 */
  function crossUrl(base, hash) { return base + (showTalk ? '?script=1' : '') + '#' + hash; }

  function renderTalkFab(p) {
    var slot = $('#appbar-slot');
    if (!slot) return;
    slot.innerHTML = (showTalk && D.talk[p])
      ? '<button type="button" class="barbtn" data-act="talk" aria-label="演示话术">话</button>'
      : '';
  }

  function openTalk() {
    var t = D.talk[path()];
    if (!t) return;
    openSheet(t.t,
      '<div class="talk"><ul class="stack g10">' +
      t.p.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') +
      '</ul><div class="talk__q">' + esc(t.q) + '</div>' +
      '<button type="button" class="btn btn--ghost" data-act="reset">重置演示数据</button></div>');
  }

  /* 演示之间清场：登记、报名、会员等级全部清掉 */
  function resetDemo() {
    try {
      Object.keys(localStorage).filter(function (k) { return k.indexOf(NS) === 0; })
        .forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
    location.hash = '/home';
    location.reload();
  }

  /* ------------------------------------------------------------------ 事件 */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');

    if (act === 'go') { go(el.getAttribute('data-to')); }
    else if (act === 'submit') { submitReg(); }
    else if (act === 'cat') {
      var c = el.getAttribute('data-cat');
      var i = state.cats.indexOf(c);
      if (i > -1) state.cats.splice(i, 1); else state.cats.push(c);
      save('cats', state.cats);
      var on = i === -1;
      el.classList.toggle('chip--on', on);
      el.setAttribute('aria-pressed', String(on));
    }
    else if (act === 'meettab') { state.meetTab = el.getAttribute('data-tab'); render(); }
    else if (act === 'signup') { signup(el.getAttribute('data-id')); }
    else if (act === 'buy') {
      state.vas[el.getAttribute('data-id')] = true;
      save('vas', state.vas);
      render();
      toast('已开通（演示，不产生扣款）');
    }
    else if (act === 'copylink') { copyText(D.exhibitor.link); }
    else if (act === 'vscript') { openScript(); }
    else if (act === 'copyscript') {
      copyText(D.exhibitor.videoScript.lines.map(function (l) { return l.txt; }).join('\n'));
    }
    else if (act === 'celeb') { openCeleb(); }
    else if (act === 'celeb-make') { closeSheet(); toast('已加入生成队列，约 3 分钟后可下载（演示）'); }
    else if (act === 'calcity') { state.calCity = el.getAttribute('data-city'); render(); }
    else if (act === 'calgo') {
      if (el.getAttribute('data-st') === 'soon') { toast('该场次尚未开放报名'); return; }
      go('/forum');
    }
    else if (act === 'task') {
      var tid = el.getAttribute('data-id');
      var cur = D.staff.tasks.filter(function (t) { return t.id === tid; })[0];
      var now = state.tasks[tid] != null ? state.tasks[tid] : (cur && cur.done);
      state.tasks[tid] = !now;
      save('tasks', state.tasks);
      render();
    }
    else if (act === 'copytxt') { copyText(D.staff.copies[+el.getAttribute('data-i')].txt); }
    else if (act === 'poster') { openPoster(); }
    else if (act === 'psize') { poster.size = el.getAttribute('data-size'); openPoster(); }
    else if (act === 'pcopy') { poster.copy = (poster.copy + 1) % D.exhibitor.posterCopy.length; openPoster(); }
    else if (act === 'pcopytext') { copyText(D.exhibitor.posterCopy[poster.copy]); }
    else if (act === 'withdraw') { toast('提现申请已提交，T+1 到账（演示）'); }
    else if (act === 'scan') { doScan(); }
    else if (act === 'manual') {
      openSheet('人工补签',
        '<div class="stack g10">' +
        '<label class="field"><span class="field__label">手机号</span>' +
        '<input type="tel" inputmode="numeric" maxlength="11" placeholder="输入观众手机号" autocomplete="off"></label>' +
        '<button type="button" class="btn btn--primary" data-act="manual-ok">确认补签</button>' +
        '<p class="note">补签会记录操作人与时间，可在后台撤销。</p></div>');
    }
    else if (act === 'manual-ok') { closeSheet(); toast('补签成功 · 已记录操作人（演示）'); }
    else if (act === 'talk') { openTalk(); }
    else if (act === 'reset') { resetDemo(); }
    else if (act === 'sheet-close') { closeSheet(); }
  });

  $('#back').addEventListener('click', back);
  window.addEventListener('hashchange', render);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });

  if (!location.hash) location.replace('#/home');
  render();
})();
