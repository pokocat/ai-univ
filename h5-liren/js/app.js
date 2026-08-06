/* 小程序 B · 丽人公社（AI 学习社群）—— H5 mobile
   纯静态：无后端、无网络请求。状态存 localStorage，与小程序 A（展会预登记）共用前缀。 */
(function () {
  'use strict';

  var D = window.DATA;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ------------------------------------------------------------------ 存储 */
  var NS = 'lrgs:';
  function load(k, dflt) {
    try { var v = localStorage.getItem(NS + k); return v == null ? dflt : JSON.parse(v); }
    catch (e) { return dflt; }
  }
  function save(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) {} }

  var state = {
    tier: load('tier', 'free'),
    profile: load('profile', null),
    step: load('junshiStep', 1),   // AI 军师对话已显示的条数
    typing: false,
    overrides: {},                 // 用户自己输入的话（仅本次会话）
    groupExtra: [],                // 在群里发过的话（仅本次会话）
    groupTyping: false,
    query: ''
  };

  function tier() { return D.tiers[state.tier] ? state.tier : 'free'; }
  function isFree() { return tier() === 'free'; }
  function who() {
    var p = state.profile || {};
    return {
      name: (p.name || D.defaultProfile.name),
      company: (p.company || D.defaultProfile.company).replace(/（.*?）/, '')
    };
  }

  /* ------------------------------------------------------------------ 工具 */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
  function scrollBottom() {
    var v = $('#view');
    v.scrollTop = v.scrollHeight;
  }

  /* ------------------------------------------------------------------ 路由 */
  var ROUTES = {
    '/messages': { title: '消息',              tab: 'msg', view: viewMessages, mount: mountMessages },
    '/square':   { title: 'AI 学习社群 · 32人', tab: 'sq',  view: viewSquare,   mount: mountChat, chat: true },
    '/junshi':   { title: 'AI 军师',            tab: 'msg', view: viewJunshi,   mount: mountChat, chat: true },
    '/report':   { title: '诊断报告',           tab: 'msg', view: viewReport },
    '/plans':    { title: '会员方案',           tab: 'me',  view: viewPlans },
    '/store':    { title: '门店经营台',         tab: 'biz', view: viewStore }
  };
  var TABS = [
    { key: 'msg', name: '消息', to: '/messages' },
    { key: 'sq',  name: '广场', to: '/square' },
    { key: 'biz', name: '经营', to: '/store' },
    { key: 'me',  name: '我的', to: '/plans' }
  ];

  /* 底部 tab 图标 · 24×24 线性图标，跟随 currentColor */
  var ICONS = {
    msg: '<path d="M20.4 11.6c0 4.1-3.8 7.4-8.4 7.4-1 0-2-.2-2.9-.5L4.2 20l1.3-3.4c-1.2-1.3-1.9-3-1.9-5 0-4.1 3.8-7.4 8.4-7.4s8.4 3.3 8.4 7.4Z"/>',
    sq:  '<rect x="3.8" y="3.8" width="7" height="7" rx="2.2"/><rect x="13.2" y="3.8" width="7" height="7" rx="2.2"/><rect x="3.8" y="13.2" width="7" height="7" rx="2.2"/><rect x="13.2" y="13.2" width="7" height="7" rx="2.2"/>',
    biz: '<path d="M4.2 3.8v16h15.6"/><path d="M8.4 16.2v-4.4M12.4 16.2V7.4M16.4 16.2v-6.6"/>',
    me:  '<circle cx="12" cy="8.2" r="3.4"/><path d="M4.9 19.8c0-3.6 3.2-5.7 7.1-5.7s7.1 2.1 7.1 5.7"/>'
  };
  function icon(k) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[k] || '') + '</svg>';
  }

  var depth = 0;
  function path() {
    var h = location.hash.replace(/^#/, '');
    return ROUTES[h] ? h : '/messages';
  }
  function go(to) {
    if (to === path()) { render(); return; }
    depth++;
    location.hash = to;
  }
  function back() {
    if (depth > 0) { depth--; history.back(); }
    else { location.replace('#/messages'); render(); }
  }

  /* ------------------------------------------------------------------ 渲染 */
  var genTimer = null, typeTimer = null;

  function render() {
    var p = path(), r = ROUTES[p];
    clearTimeout(typeTimer);
    if (p !== '/report') { clearTimeout(genTimer); generating = false; }

    $('#appbar-title').textContent = r.title;
    $('#back').hidden = (p === '/messages');

    var view = $('#view');
    view.className = 'view' + (r.chat ? ' view--chat' : '');
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
    document.title = r.title + ' · 丽人公社';
  }

  /* ------------------------------------------------------------- B1 消息 */
  function threadHTML(t) {
    var locked = isFree() && t.lock;
    var msg = locked ? '学习会员可用 · 点击了解' : t.msg;
    var badge = (!locked && t.badge) ? '<span class="thread__dot">' + t.badge + '</span>' : '';
    var avStyle = t.avCls ? '' : ' style="background:' + t.avBg + ';color:' + t.avFg + '"';
    var href = t.href ? (showTalk ? t.href.replace('#', '?script=1#') : t.href) : '';
    var tag = t.href ? 'a href="' + esc(href) + '"' : 'button type="button"';
    var act = t.href ? '' : ' data-act="thread" data-id="' + esc(t.id) + '"';
    return '<' + tag + ' class="thread' + (locked ? ' thread--lock' : '') + '"' + act +
        ' data-name="' + esc(t.name) + '" data-msg="' + esc(t.msg) + '">' +
        '<span class="avatar thread__av ' + (t.avCls || '') + '"' + avStyle + '>' + esc(t.av) + badge + '</span>' +
        '<span class="thread__main">' +
          '<span class="thread__top"><span class="thread__name">' + esc(t.name) + '</span>' +
          '<span class="thread__time">' + esc(t.time) + '</span></span>' +
          '<span class="thread__msg">' + esc(msg) + '</span>' +
        '</span>' +
      '</' + (t.href ? 'a' : 'button') + '>';
  }

  function upsell() {
    if (isFree()) return { label: '解锁更多', title: '升级学习会员 ¥99/月', desc: '四位超级智能体全开 · 军师无限次', act: 'go', to: '/plans' };
    if (tier() === 'pro') return { label: '专属服务', title: '升级品牌主理人', desc: '1 对 1 军师陪跑 · 门店经营台 · 大会席位', act: 'go', to: '/plans' };
    return { label: '专属服务', title: '预约本月 1 对 1 复盘', desc: '剩余 2 次 · 军师全程参与', act: 'book' };
  }

  function viewMessages() {
    var u = upsell();
    return '' +
      '<div class="searchbar">' +
        '<label class="searchbar__in"><i></i>' +
          '<input id="q" type="search" placeholder="搜索社群、成员、智能体" autocomplete="off" value="' + esc(state.query) + '">' +
        '</label>' +
        '<button type="button" class="avatar av--ai searchbar__ai" data-act="go" data-to="/junshi" aria-label="打开 AI 军师">军</button>' +
      '</div>' +
      '<div id="threads">' + D.threads.map(threadHTML).join('') + '</div>' +
      '<div class="pad stack g9">' +
        '<span class="label">' + esc(u.label) + '</span>' +
        '<button type="button" class="upsell" data-act="' + u.act + '"' + (u.to ? ' data-to="' + u.to + '"' : '') + '>' +
          '<span class="upsell__txt"><b>' + esc(u.title) + '</b><span>' + esc(u.desc) + '</span></span><i></i>' +
        '</button>' +
      '</div>';
  }

  function mountMessages(root) {
    var q = $('#q', root);
    q.addEventListener('input', function () {
      state.query = q.value.trim();
      var k = state.query.toLowerCase();
      $$('.thread', root).forEach(function (el) {
        var hay = (el.getAttribute('data-name') + ' ' + el.getAttribute('data-msg')).toLowerCase();
        el.hidden = !!k && hay.indexOf(k) === -1;
      });
    });
  }

  function openThread(id) {
    var t = D.threads.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    if (isFree() && t.lock) { toast('该智能体为学习会员权益'); go('/plans'); return; }
    go(t.to);
  }

  /* --------------------------------------------------------- 聊天气泡通用 */
  function msgHTML(m, text) {
    var me = m.who === 'me';
    var ai = m.who === 'ai';
    var avStyle = ai ? '' : ' style="background:' + (m.avBg || '#EFE7DE') + ';color:' + (m.avFg || '#6B5B4E') + '"';
    var body = '<div class="bubble">' + esc(text != null ? text : m.text) + '</div>';

    if (m.card) {
      body += '<div class="datacard">' +
        '<div class="datacard__h"><i></i><span>' + esc(m.card.title) + '</span></div>' +
        '<div class="stack g8">' + m.card.rows.map(function (r) {
          return '<div class="datacard__r"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>';
        }).join('') + '</div>' +
        '<button type="button" class="datacard__b" data-act="go" data-to="/junshi">让军师展开讲讲</button>' +
        '</div>';
    }
    if (m.file) {
      body += '<div class="filecard"><i></i><div style="min-width:0">' +
        '<b>' + esc(m.file.name) + '</b><span>' + esc(m.file.meta) + '</span></div></div>';
    }

    return '<div class="msg' + (me ? ' msg--me' : '') + '">' +
        '<span class="avatar msg__av ' + (ai ? 'av--ai' : '') + '"' + avStyle + '>' + esc(m.av || (ai ? '军' : '我')) + '</span>' +
        '<div class="msg__col">' +
          (m.name ? '<span class="msg__name">' + esc(m.name) + '</span>' : '') +
          body +
        '</div>' +
      '</div>';
  }

  function typingHTML() {
    return '<div class="msg">' +
      '<span class="avatar msg__av av--ai">军</span>' +
      '<div class="msg__col"><div class="typing"><i></i><i></i><i></i></div></div></div>';
  }

  function mountChat() { scrollBottom(); }

  /* ------------------------------------------------------------- B2 广场 */
  function squareBody() {
    var list = D.group.concat(state.groupExtra);
    return '<div class="daychip">今天 10:24</div>' +
      list.map(function (m) { return msgHTML(m); }).join('') +
      (state.groupTyping ? '<div class="msg"><span class="avatar msg__av" style="background:#FCE3CD;color:#773B00">店</span>' +
        '<div class="msg__col"><div class="typing"><i></i><i></i><i></i></div></div></div>' : '');
  }

  function viewSquare() {
    return '<div class="chat">' +
        '<div class="chat__body" id="chatbody">' + squareBody() + '</div>' +
        '<div class="composer">' +
          '<div class="composer__row">' +
            '<span style="width:32px;height:32px;flex:none;border-radius:50%;border:1.4px solid rgba(28,26,23,.22)"></span>' +
            '<label class="composer__in"><input id="say" placeholder="说点什么…" autocomplete="off"></label>' +
            '<button type="button" class="avatar av--ai composer__ai" id="sqbtn" data-act="say" aria-label="发送或打开 AI 军师">军</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function syncSqBtn() {
    var input = $('#say'), btn = $('#sqbtn');
    if (!input || !btn) return;
    if (input.value.trim()) {
      btn.className = 'composer__send';
      btn.textContent = '发送';
    } else {
      btn.className = 'avatar av--ai composer__ai';
      btn.textContent = '军';
    }
  }

  function saySquare() {
    var input = $('#say');
    var txt = input ? input.value.trim() : '';
    if (!txt) { go('/junshi'); return; }
    var w = who();
    state.groupExtra.push({ who: 'me', av: w.name.slice(0, 1), avBg: '#FCD4C3', avFg: '#822D1F', name: '我', text: txt });
    input.value = '';
    syncSqBtn();
    $('#chatbody').innerHTML = squareBody();
    scrollBottom();

    state.groupTyping = true;
    $('#chatbody').innerHTML = squareBody();
    scrollBottom();
    clearTimeout(typeTimer);
    typeTimer = setTimeout(function () {
      state.groupTyping = false;
      state.groupExtra.push(D.groupReply);
      if ($('#chatbody')) { $('#chatbody').innerHTML = squareBody(); scrollBottom(); }
    }, 900);
  }

  /* ------------------------------------------------------------ B3 军师 */
  function shown() { return Math.min(state.step, D.junshi.length); }
  function canMore() { return state.step < D.junshi.length; }

  function junshiBody() {
    var head = '<div class="ai-intro">' +
        '<span class="avatar av--ai ai-intro__av">军</span>' +
        '<p>AI 军师 · 服务于门店与品牌的经营顾问<br>不提供医疗诊断与疗效承诺</p>' +
      '</div>';
    var msgs = D.junshi.slice(0, shown()).map(function (m, i) {
      return msgHTML(
        { who: m.who, av: m.who === 'ai' ? '军' : who().name.slice(0, 1),
          avBg: '#FCD4C3', avFg: '#822D1F', file: state.overrides[i] ? null : m.file },
        state.overrides[i] != null ? state.overrides[i] : m.text
      );
    }).join('');
    return head + msgs + (state.typing ? typingHTML() : '');
  }

  function viewJunshi() {
    return '<div class="chat chat--ai">' +
        '<div class="chat__body" id="chatbody">' + junshiBody() + '</div>' +
        '<div class="composer">' +
          '<div class="quick" id="quick">' + quickHTML() + '</div>' +
          '<div class="composer__row">' +
            '<label class="composer__in"><input id="say" placeholder="说说你的门店情况…" autocomplete="off"></label>' +
            '<button type="button" class="composer__send" id="jbtn" data-act="jnext">' + jbtnText() + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function quickHTML() {
    var qs = (canMore() && !state.typing) ? (D.quick[shown()] || []) : [];
    return qs.map(function (q, i) {
      return '<button type="button"' + (q.primary ? ' class="is-primary"' : '') +
        ' data-act="quick" data-i="' + i + '">' + esc(q.label) + '</button>';
    }).join('');
  }

  function jbtnText() {
    var input = $('#say');
    if (input && input.value.trim()) return '发送';
    return canMore() ? '继续' : '查看报告';
  }

  function syncJunshi() {
    var q = $('#quick'); if (q) q.innerHTML = quickHTML();
    var b = $('#jbtn'); if (b) {
      b.textContent = jbtnText();
    }
  }

  function refreshJunshi() {
    var body = $('#chatbody');
    if (body) { body.innerHTML = junshiBody(); scrollBottom(); }
    syncJunshi();
  }

  function advance(custom) {
    if (state.typing || !canMore()) return;
    var i = state.step;
    var next = D.junshi[i];

    if (next.who === 'me') {
      if (custom) state.overrides[i] = custom;
      state.step = i + 1; save('junshiStep', state.step);
      refreshJunshi();
      if (canMore() && D.junshi[state.step].who === 'ai') {
        state.typing = true; refreshJunshi();
        clearTimeout(typeTimer);
        typeTimer = setTimeout(function () {
          state.typing = false;
          state.step = Math.min(state.step + 1, D.junshi.length);
          save('junshiStep', state.step);
          refreshJunshi();
        }, 900);
      }
    } else {
      state.typing = true; refreshJunshi();
      clearTimeout(typeTimer);
      typeTimer = setTimeout(function () {
        state.typing = false;
        state.step = Math.min(state.step + 1, D.junshi.length);
        save('junshiStep', state.step);
        refreshJunshi();
      }, 800);
    }
  }

  function junshiNext() {
    var input = $('#say');
    var txt = input ? input.value.trim() : '';
    if (txt) {
      input.value = '';
      if (canMore() && D.junshi[state.step].who === 'me') advance(txt);
      else { toast('军师已经在出报告了'); }
      syncJunshi();
      return;
    }
    if (canMore()) advance();
    else openReport();
  }

  /* ------------------------------------------------------------ B4 报告 */
  var generating = false;
  function openReport() { generating = true; go('/report'); }

  function viewReport() {
    if (generating) {
      clearTimeout(genTimer);
      genTimer = setTimeout(function () { generating = false; render(); }, 1300);
      return '<div class="gen">' +
        '<span class="avatar av--ai gen__av">军</span>' +
        '<p>正在按顾问口径整理诊断报告…<br>现状扫描 · 关键问题 · 90 天行动路线</p>' +
        '<span class="gen__bar"><i></i></span></div>';
    }

    var R = D.report, locked = isFree();

    /* 抬头固定用样本门店名：报告正文里的数字都是这家店的，换成别的公司名会自相矛盾 */
    var head = '<div class="rpt-head">' +
        '<div class="rpt-head__top">' +
          '<div><div class="rpt-head__eyebrow">AI 军师 · 经营诊断报告</div>' +
          '<h2 class="rpt-head__t">' + esc(R.store) + '<br>' + esc(R.title) + '</h2></div>' +
          '<div class="rpt-head__grade"><b>' + esc(R.grade) + '</b><span>AI 就绪度</span></div>' +
        '</div>' +
        '<div class="rpt-head__meta"><span>编号 ' + esc(R.no) + '</span><span>' + esc(R.date) + '</span><span>' + esc(R.basis) + '</span></div>' +
      '</div>';

    var s1 = sec('01', '核心结论', '<div class="rpt-summary">' + esc(R.summary) + '</div>');

    var s2 = sec('02', '现状扫描', '<div class="metrics">' + R.metrics.map(function (m) {
      return '<div class="metric"><div class="metric__k">' + esc(m.k) + '</div>' +
        '<div class="metric__v"><b style="color:' + m.fg + '">' + esc(m.v) + '</b><span>' + esc(m.unit) + '</span></div>' +
        '<div class="metric__bar"><i style="width:' + m.pct + ';background:' + m.fg + '"></i></div></div>';
    }).join('') + '</div>');

    var s3 = sec('03', '三个关键问题', '<div class="stack g8">' + R.issues.map(function (it) {
      return '<div class="issue"><span class="issue__lv issue__lv--' + it.cls + '">' + esc(it.lv) + '</span>' +
        '<div><b>' + esc(it.t) + '</b><p>' + esc(it.d) + '</p></div></div>';
    }).join('') + '</div>');

    var tail;
    if (locked) {
      tail = '<div class="locked">' +
          '<span class="locked__ico"><i></i></span>' +
          '<div><b>后续 2 个板块为会员内容</b>' +
          '<p>90 天行动路线图、投入与前提说明<br>升级学习会员后解锁，并可预约 1 对 1 复盘</p></div>' +
          '<button type="button" class="btn btn--gold" data-act="go" data-to="/plans">查看会员方案</button>' +
        '</div>';
    } else {
      var s4 = sec('04', '90 天行动路线', '<div class="tl">' + R.phases.map(function (p) {
        return '<div class="tl__row"><div class="tl__rail"><i style="background:' + p.dot + '"></i><span></span></div>' +
          '<div class="tl__body"><div class="tl__t"><b>' + esc(p.t) + '</b><em>' + esc(p.range) + '</em></div>' +
          '<div class="tl__d">' + esc(p.d) + '</div></div></div>';
      }).join('') + '</div>');

      var s5 = sec('05', '前提与口径', '<div class="disclaimer" style="line-height:1.95;font-size:11.5px">' + esc(R.caveat) + '</div>');

      tail = s4 + s5 +
        '<div class="rpt-actions">' +
          '<button type="button" class="btn btn--ghost" data-act="print">导出 PDF</button>' +
          '<button type="button" class="btn btn--primary" data-act="book">预约 1 对 1 复盘</button>' +
        '</div>';
    }

    return head + '<div class="pad stack g16">' + s1 + s2 + s3 + tail + '</div>';
  }

  function sec(n, title, inner) {
    return '<section class="rpt-sec"><div class="rpt-sec__h"><em>' + n + '</em><b>' + esc(title) + '</b></div>' + inner + '</section>';
  }

  /* ------------------------------------------------------------ B5 会员 */
  function viewPlans() {
    var w = who(), cur = tier(), m = D.tiers[cur];

    var cards = ['free', 'pro', 'vip'].map(function (k) {
      var t = D.tiers[k], hi = (k === 'pro'), isCur = (k === cur);
      var btnTxt = isCur ? '当前方案' : (k === 'free' ? '降级' : '立即升级');
      var btnStyle = isCur
        ? 'background:transparent;border-color:' + (hi ? 'rgba(255,255,255,.2)' : 'rgba(28,26,23,.12)') + ';color:' + (hi ? 'rgba(255,255,255,.5)' : 'rgba(28,26,23,.4)')
        : (hi ? 'background:#BD7221;color:#241A0D'
              : (k === 'vip' ? 'background:#1C1A17;color:#fff' : 'border-color:rgba(28,26,23,.14);color:rgba(28,26,23,.6)'));

      return '<div class="plan' + (hi ? ' plan--hi' : '') + (isCur ? ' plan--cur' : '') + '">' +
          '<div class="plan__top">' +
            '<div><div class="plan__name"><b>' + esc(t.name) + '</b>' +
              (hi ? '<span class="plan__badge">最多人选</span>' : '') + '</div>' +
              '<div class="plan__desc">' + esc(t.note) + '</div></div>' +
            '<div class="plan__price"><b>' + esc(t.price) + '</b><span>' + esc(t.unit) + '</span></div>' +
          '</div>' +
          '<ul class="plan__items">' + D.planItems[k].map(function (x) {
            return '<li><i></i><span>' + esc(x) + '</span></li>';
          }).join('') + '</ul>' +
          '<button type="button" class="plan__btn" style="' + btnStyle + '"' +
            (isCur ? ' disabled' : ' data-act="tier" data-tier="' + k + '"') + '>' + btnTxt + '</button>' +
        '</div>';
    }).join('');

    return '<div class="pad stack g16">' +
        '<div class="mecard">' +
          '<span class="avatar mecard__av">' + esc(w.name.slice(0, 1)) + '</span>' +
          '<div class="mecard__txt"><b>' + esc(w.name) + ' · ' + esc(w.company) + '</b>' +
          '<span>' + esc(m.name) + ' · ' + esc(m.note) + '</span></div>' +
        '</div>' +
        '<div class="stack g10">' +
          '<h2 class="serif" style="font-size:16px">会员方案</h2>' + cards +
        '</div>' +
        '<p class="disclaimer">会员权益与价格为演示排布，正式方案以合作协议为准。会员内容不含医疗服务。</p>' +
      '</div>';
  }

  function setTier(k) {
    if (!D.tiers[k]) return;
    state.tier = k;
    save('tier', k);
    render();
    toast('已切换为「' + D.tiers[k].name + '」（演示，未发生扣款）');
  }

  /* ------------------------------------------------------------ B6 经营台 */
  function viewStore() {
    return '<div class="pad stack g16">' +
        '<div class="stack g5">' +
          '<h2 class="serif" style="font-size:18px">门店经营台</h2>' +
          '<p class="note">' + esc(D.storeName) + ' · 数据截至今日 18:00</p>' +
        '</div>' +

        '<div class="kpis">' + D.storeStats.map(function (s) {
          return '<div class="kpi"><div class="kpi__k">' + esc(s.k) + '</div>' +
            '<div class="kpi__v"><b>' + esc(s.v) + '</b><span style="color:' + s.fg + '">' + esc(s.d) + '</span></div></div>';
        }).join('') + '</div>' +

        '<div class="stack g10">' +
          '<span class="label">数据来源 · 接入状态</span>' +
          '<div class="integrations">' + D.integrations.map(function (g) {
            return '<div class="integration">' +
              '<span class="integration__tag' + (g.off ? ' integration__tag--off' : '') + '">' + esc(g.tag) + '</span>' +
              '<div class="integration__txt"><b>' + esc(g.name) + '</b><span>' + esc(g.desc) + '</span></div>' +
              '<span class="integration__st' + (g.off ? ' integration__st--off' : '') + '">' + esc(g.st) + '</span></div>';
          }).join('') + '</div>' +
        '</div>' +

        '<div class="remind">' +
          '<div class="remind__h"><i>军</i><b>军师今日提醒</b></div>' +
          '<p>' + esc(D.remind) + '</p>' +
          '<div class="remind__row">' +
            '<button type="button" data-act="callbacks">查看名单</button>' +
            '<button type="button" class="is-gold" data-act="send-callbacks">确认发送</button>' +
          '</div>' +
        '</div>' +

        '<p class="disclaimer">门店数据为演示数据。真实接入需门店授权，客户健康数据的采集与使用需单独取得同意。</p>' +
      '</div>';
  }

  function openCallbacks() {
    openSheet('30 天未到店客户 · 18 人',
      '<p class="note" style="margin-bottom:10px">以下为前 6 位，号码已脱敏。发送前由店长逐条确认。</p>' +
      D.callbacks.map(function (c) {
        return '<div class="person"><span class="avatar person__av">' + esc(c.av) + '</span>' +
          '<div class="person__txt"><b>' + esc(c.name) + '</b><span>' + esc(c.tag) + '</span></div>' +
          '<em>' + esc(c.phone) + '</em></div>';
      }).join(''));
  }

  function openBooking() {
    openSheet('预约 1 对 1 军师复盘',
      '<div class="stack g8">' +
        D.slots.map(function (s, i) {
          return '<button type="button" class="slot" data-act="slot" data-i="' + i + '">' +
            '<span class="slot__txt"><b>' + esc(s) + '</b><span>线上 · 60 分钟 · 军师与顾问同时在场</span></span>' +
            '<i style="width:8px;height:8px;border-right:1.6px solid rgba(28,26,23,.3);border-bottom:1.6px solid rgba(28,26,23,.3);transform:rotate(-45deg)"></i>' +
          '</button>';
        }).join('') +
      '</div>' +
      '<p class="disclaimer" style="margin-top:12px">演示排期，正式时间以顾问确认为准。</p>');
  }

  /* ------------------------------------------------------------- 演示话术 */
  var showTalk = /[?&]script=1/.test(location.search);
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
    openSheet(t.t, '<div class="talk"><ul class="stack g10">' +
      t.p.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') +
      '</ul><div class="talk__q">' + esc(t.q) + '</div>' +
      '<button type="button" class="btn btn--ghost" data-act="reset">重置演示数据</button></div>');
  }

  /* 演示之间清场：会员等级、军师进度、预登记资料全部清掉 */
  function resetDemo() {
    try {
      Object.keys(localStorage).filter(function (k) { return k.indexOf(NS) === 0; })
        .forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
    location.hash = '/messages';
    location.reload();
  }

  /* ------------------------------------------------------------------ 事件 */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');

    if (act === 'go') go(el.getAttribute('data-to'));
    else if (act === 'thread') openThread(el.getAttribute('data-id'));
    else if (act === 'say') saySquare();
    else if (act === 'jnext') junshiNext();
    else if (act === 'quick') {
      /* 快捷回复只是「替他点一下」，气泡仍用脚本原文（含会议记录附件卡） */
      advance();
    }
    else if (act === 'tier') setTier(el.getAttribute('data-tier'));
    else if (act === 'print') window.print();
    else if (act === 'book') openBooking();
    else if (act === 'slot') { closeSheet(); toast('已预约 ' + D.slots[+el.getAttribute('data-i')] + '，顾问将确认'); }
    else if (act === 'callbacks') openCallbacks();
    else if (act === 'send-callbacks') { toast('18 条回访已排入今晚 19:30 发送队列'); go('/square'); }
    else if (act === 'talk') openTalk();
    else if (act === 'reset') resetDemo();
    else if (act === 'sheet-close') closeSheet();
  });

  /* 输入框：回车发送 + 按钮态同步 */
  document.addEventListener('input', function (e) {
    if (e.target.id !== 'say') return;
    if (path() === '/square') syncSqBtn(); else syncJunshi();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeSheet(); return; }
    if (e.key === 'Enter' && e.target.id === 'say') {
      e.preventDefault();
      if (path() === '/square') saySquare(); else junshiNext();
    }
  });

  $('#back').addEventListener('click', back);
  window.addEventListener('hashchange', render);

  if (!location.hash) location.replace('#/messages');
  render();
})();
