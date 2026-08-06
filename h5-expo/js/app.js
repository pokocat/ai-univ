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
    meetTab: '全部'
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
    '/forum':    { title: '同期论坛',   tab: 'agenda', bar: 'light', view: viewForum }
  };
  var TABS = [
    { key: 'expo',   name: '展会', to: '/home' },
    { key: 'agenda', name: '日程', to: '/forum' },
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
      '</div>';
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
