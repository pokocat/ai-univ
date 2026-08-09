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
    plaza: load('plaza', {}),      // 已单独解锁的广场群 id
    step: load('junshiStep', 1),   // AI 军师对话已显示的条数
    typing: false,
    overrides: {},                 // 用户自己输入的话（仅本次会话）
    groupExtra: [],                // 在群里发过的话（仅本次会话）
    groupTyping: false,
    query: '',
    cat: '第二周留人',            // 出片模板库当前分类
    asTab: 0,                     // 资产库当前分类
    selfServe: load('selfServe', true)
  };

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    '/plaza':    { title: '社群广场 · 全部',    tab: 'msg', view: viewPlaza },
    '/square':   { title: 'AI 学习社群 · 32人', tab: 'msg', view: viewSquare,   mount: mountChat, chat: true },
    '/junshi':   { title: 'AI 军师',            tab: 'msg', view: viewJunshi,   mount: mountChat, chat: true },
    '/report':   { title: '诊断报告',           tab: 'msg', view: viewReport },
    '/ops':      { title: '运营',               tab: 'ops', view: viewOps },
    '/studio':   { title: '选一个模板开拍',     tab: 'ops', view: viewStudio },
    '/produce':  { title: '出片与分发',         tab: 'ops', view: viewProduce, mount: mountProduce },
    '/assets':   { title: '数字资产库',         tab: 'ops', view: viewAssets },
    '/plans':    { title: '会员方案',           tab: 'me',  view: viewPlans },
    '/store':    { title: '门店经营台',         tab: 'biz', view: viewStore }
  };
  var TABS = [
    { key: 'msg', name: '消息', to: '/messages' },
    { key: 'ops', name: '运营', to: '/ops' },
    { key: 'biz', name: '门店', to: '/store' },
    { key: 'me',  name: '我的', to: '/plans' }
  ];

  /* 底部 tab 图标 · 24×24 线性图标，跟随 currentColor */
  var ICONS = {
    msg: '<path d="M20.4 11.6c0 4.1-3.8 7.4-8.4 7.4-1 0-2-.2-2.9-.5L4.2 20l1.3-3.4c-1.2-1.3-1.9-3-1.9-5 0-4.1 3.8-7.4 8.4-7.4s8.4 3.3 8.4 7.4Z"/>',
    ops: '<path d="M4.4 18.6 9 11.4l3.6 3 3-4.6 4 8.8Z"/><circle cx="7.2" cy="6" r="2.1"/><path d="M4.4 18.6h15.2"/>',
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
    if (p !== '/produce' && pdTimer) { clearInterval(pdTimer); pdTimer = null; }

    $('#appbar-title').textContent = r.title;
    /* tab 根页面不显示返回箭头，只有下钻页才显示 */
    $('#back').hidden = TABS.some(function (t) { return t.to === p; });

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
    if (isFree()) return { label: '解锁更多', title: '升级学习会员 ¥99/月', desc: '广场付费群全部解锁 · 四位智能体全开 · 军师无限次', act: 'go', to: '/plans' };
    if (tier() === 'pro') return { label: '专属服务', title: '升级品牌主理人', desc: '1 对 1 军师陪跑 · 门店经营台 · 大会席位', act: 'go', to: '/plans' };
    return { label: '专属服务', title: '预约本月 1 对 1 复盘', desc: '剩余 2 次 · 军师全程参与', act: 'book' };
  }

  /* 广场群 = 会话列表里「你没进的群」，付费墙就长在这一行上 */
  function pzThreadHTML(g) {
    var open = plazaUnlocked(g);
    var vip = g.lock === 'vip';
    var g0 = g.gems[0] || { who: '', text: '' };
    var preview = g0.who + '：' + g0.text;

    var lockCls = 'thread__lock' + (open ? ' thread__lock--open' : (vip ? ' thread__lock--vip' : ''));
    var tag = open
      ? '<span class="pricetag pricetag--ok">已解锁</span>'
      : (vip ? '<span class="pricetag pricetag--vip">仅主理人</span>'
             : '<span class="pricetag">¥9.9</span>');

    var act = open ? ' data-act="go" data-to="/plaza"' : ' data-act="pz" data-id="' + esc(g.id) + '"';

    return '<button type="button" class="thread thread--pz"' + act +
        ' data-name="' + esc(g.name) + '" data-msg="' + esc(preview) + '">' +
        '<span class="avatar thread__av" style="background:' + g.avBg + ';color:' + g.avFg + '">' +
          esc(g.av) + '<i class="' + lockCls + '"></i></span>' +
        '<span class="thread__main">' +
          '<span class="thread__top"><span class="thread__name">' + esc(g.name) + '</span>' +
          '<span class="thread__time">' + esc(open ? g.openTime : g.time) + '</span></span>' +
          '<span class="thread__row">' +
            '<span class="thread__msg' + (open ? '' : ' thread__msg--blur') + '">' + esc(preview) + '</span>' +
            tag +
          '</span>' +
        '</span>' +
      '</button>';
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

      '<div class="sechead" id="pzhead">' +
        '<span class="sechead__l">' +
          '<b class="sechead__t">广场 · 你没进的群，内容同步过来</b>' +
          '<span class="sechead__hot">' + esc(D.plaza.hotLine) + '</span>' +
        '</span>' +
        '<button type="button" class="sechead__more" data-act="go" data-to="/plaza">全部<i></i></button>' +
      '</div>' +
      '<div id="pzthreads">' + D.plaza.groups.map(pzThreadHTML).join('') + '</div>' +

      '<div class="pad stack g9">' +
        '<span class="label">' + esc(u.label) + '</span>' +
        '<button type="button" class="upsell" data-act="' + u.act + '"' + (u.to ? ' data-to="' + u.to + '"' : '') + '>' +
          '<span class="upsell__txt"><b>' + esc(u.title) + '</b><span>' + esc(u.desc) + '</span></span><i></i>' +
        '</button>' +
        '<p class="disclaimer">广场内容为演示排布，正式上架需群主授权、内容筛选与脱敏；群成员发言不代表平台观点。</p>' +
      '</div>';
  }

  function mountMessages(root) {
    var q = $('#q', root);

    function applyFilter() {
      var k = state.query.toLowerCase();
      $$('.thread', root).forEach(function (el) {
        var hay = (el.getAttribute('data-name') + ' ' + el.getAttribute('data-msg')).toLowerCase();
        el.hidden = !!k && hay.indexOf(k) === -1;
      });
      /* 广场行被过滤光时，分区带也要跟着收起，不留悬空标题 */
      var head = $('#pzhead', root);
      var anyPz = $$('.thread--pz', root).some(function (el) { return !el.hidden; });
      if (head) head.hidden = !anyPz;
    }

    q.addEventListener('input', function () {
      state.query = q.value.trim();
      applyFilter();
    });

    /* 解锁 / 切档后会整页重渲染，搜索词还在，过滤要跟着补上 */
    if (state.query) applyFilter();
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
        '<div class="chat__tools">' +
          '<button type="button" class="toolchip" data-act="daily"><i>报</i>生成今日群报</button>' +
        '</div>' +
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

  /* ------------------------------------------------------------ B7 广场 */
  function plazaUnlocked(g) {
    if (g.lock === 'vip') return tier() === 'vip';
    return !!state.plaza[g.id] || !isFree();
  }

  function gemHTML(g, i, open) {
    var hidden = !open && i > 0;
    return '<div class="gem' + (hidden ? ' gem--blur' : '') + '"' + (hidden ? ' aria-hidden="true"' : '') + '>' +
      '<span class="gem__who">' + esc(g.who) + '</span>' +
      '<p class="gem__t">' + esc(g.text) + '</p></div>';
  }

  function viewPlaza() {
    var hot = D.plaza.hot.map(function (h, i) {
      return '<div class="hotrow"><em>' + (i + 1) + '</em>' +
        '<div class="hotrow__txt"><b>' + esc(h.t) + '</b><span>' + esc(h.d) + '</span></div></div>';
    }).join('');

    var groups = D.plaza.groups.map(function (g) {
      var open = plazaUnlocked(g);
      var gems = g.gems.map(function (x, i) { return gemHTML(x, i, open); }).join('');
      var foot;
      if (open) {
        foot = '<div class="plaza__foot"><span class="plaza__new">今日新增 ' + g.today + ' 条精华</span>' +
          '<span class="plaza__ok">已解锁</span></div>';
      } else if (g.lock === 'vip') {
        foot = '<button type="button" class="plaza__cta plaza__cta--vip" data-act="go" data-to="/plans">' +
          '仅品牌主理人可见 · 了解方案</button>';
      } else {
        foot = '<button type="button" class="plaza__cta" data-act="pz" data-id="' + g.id + '">' +
          '¥9.9 解锁本群精华 · 30 天</button>';
      }
      return '<div class="card plaza">' +
        '<div class="plaza__head"><div><b class="plaza__name">' + esc(g.name) + '</b>' +
        '<span class="plaza__meta">' + esc(g.size) + ' · ' + esc(g.price) + '</span></div>' +
        '<span class="plaza__lock' + (open ? ' plaza__lock--open' : '') + '"><i></i></span></div>' +
        gems + foot + '</div>';
    }).join('');

    return '<div class="pad stack g14">' +
      '<p class="note">你只在一个群里，下面这些群的内容是同步过来的。按会员等级开放。</p>' +

      '<div class="stack g8">' +
        '<div class="plazahead"><h2 class="serif" style="font-size:16px">今日跨群热点</h2>' +
        '<span class="label">AI 聚合 · 每天 18:00 更新</span></div>' +
        '<div class="card" style="padding:6px 14px">' + hot + '</div>' +
      '</div>' +

      '<div class="stack g10">' +
        '<div class="plazahead"><h2 class="serif" style="font-size:16px">高价值群 · 精华同步</h2>' +
        '<span class="label">内容经群主授权上架</span></div>' +
        groups +
      '</div>' +

      '<p class="disclaimer">广场内容为演示排布；正式上架需群主授权、内容筛选与脱敏，价格以正式方案为准。</p>' +
    '</div>';
  }

  /* 点会话行 → 半屏预览：第一条清晰，其余模糊，底下就是价格 */
  function openPeek(id) {
    var g = D.plaza.groups.filter(function (x) { return x.id === id; })[0];
    if (!g) return;
    var open = plazaUnlocked(g);
    var vip = g.lock === 'vip';

    var foot;
    if (open) {
      foot = '<button type="button" class="btn btn--ghost" data-act="go" data-to="/plaza">进入广场看本群全部</button>';
    } else if (vip) {
      foot = '<button type="button" class="btn" style="background:var(--ink);color:#fff" ' +
        'data-act="go" data-to="/plans">仅品牌主理人可见 · 了解方案</button>';
    } else {
      foot = '<button type="button" class="btn btn--gold" data-act="unlock" data-id="' + esc(id) + '">¥9.9 · 解锁 30 天</button>' +
        '<button type="button" class="btn btn--ghost" data-act="go" data-to="/plans">升级学习会员 ¥99/月 · 付费群全解锁</button>';
    }

    openSheet(g.name,
      '<div class="stack g10">' +
        '<p class="note">' + esc(g.size) + ' · ' + esc(g.price) + ' · 今日新增 ' + g.today + ' 条精华</p>' +
        '<div class="stack g8">' + g.gems.map(function (x, i) { return gemHTML(x, i, open); }).join('') + '</div>' +
        foot +
        '<p class="disclaimer">演示环境，点击不会产生真实扣款。</p>' +
      '</div>');
  }

  function unlockPlaza(id) {
    state.plaza[id] = true;
    save('plaza', state.plaza);
    closeSheet();
    render();
    toast('已解锁 30 天（演示，未发生扣款）');
  }

  /* 今日群报（分享卡片） */
  function openDaily() {
    var d = D.daily;
    openSheet('今日群报',
      '<div class="dailycard">' +
        '<div class="dailycard__head"><span class="dailycard__brand">丽人公社 · 群报</span>' +
        '<span class="dailycard__date">' + esc(d.date) + '</span></div>' +
        '<div class="dailycard__group">' + esc(d.group) + '<em>' + esc(d.stats) + '</em></div>' +
        '<div class="dailycard__points">' + d.points.map(function (p, i) {
          return '<div class="dailycard__p"><em>' + (i + 1) + '</em><span>' + esc(p) + '</span></div>';
        }).join('') + '</div>' +
        '<div class="dailycard__quote">' + esc(d.quote) + '</div>' +
        '<div class="dailycard__foot"><img src="assets/qr.svg" alt=""><span>扫码加入 AI 学习社群<br>由 AI 军师每日自动生成</span></div>' +
      '</div>' +
      '<div class="stack g8" style="margin-top:12px">' +
        '<button type="button" class="btn btn--vio" data-act="daily-share">转发给群友 · 邀请入群</button>' +
        '<p class="note" style="text-align:center">同一群、同一天的群报只生成一次，全员复用</p>' +
      '</div>');
  }

  /* ==========================================================================
     运营工具 —— 移植温泉酒店的「经营主线」逻辑
     ========================================================================== */

  /* ------------------------------------------------------- B8 运营主线 */
  function viewOps() {
    var L = D.mainline, A = D.todayAction;

    /* 导轨：点 + 连接段，卡住那步是琥珀空心圈 */
    var rail = '';
    L.steps.forEach(function (s, i) {
      rail += '<span class="rail__dot rail__dot--' + s.state + '"></span>';
      if (i < L.steps.length - 1) {
        rail += '<span class="rail__seg' + (s.state === 'done' ? ' rail__seg--on' : '') + '"></span>';
      }
    });

    var steps = L.steps.map(function (s) {
      var m = s.state === 'stuck' ? '--stuck' : (s.state === 'todo' ? '--todo' : '');
      return '<div class="steps__col"><div class="steps__n steps__n' + m + '">' + esc(s.name) + '</div>' +
        '<div class="steps__v steps__v' + m + '">' + esc(s.value) + '</div></div>';
    }).join('');

    var stats = D.homeStats.map(function (s) {
      return '<div class="card" style="padding:14px 15px">' +
        '<div class="duo__k">' + esc(s.k) + '</div>' +
        '<div class="duo__v">' + esc(s.v) + (s.unit ? '<em>' + esc(s.unit) + '</em>' : '') + '</div>' +
        '<div class="duo__f' + (s.green ? ' duo__f--pos' : '') + '">' + esc(s.foot) + '</div></div>';
    }).join('');

    var sc = D.shortcuts.map(function (x) {
      return '<button type="button" class="sc" data-act="go" data-to="' + esc(x.to) + '">' +
        '<span class="sc__tile sc__tile--' + x.bg + '">' + esc(x.ico) + '</span>' +
        '<span class="sc__n">' + esc(x.n) + '</span></button>';
    }).join('');

    return '<div class="pad stack g14">' +
      '<div class="ophead">' +
        '<div><div class="ophead__hi">早上好，' + esc(who().name) + '</div>' +
        '<div class="ophead__t">' + esc(D.storeName.split(' · ')[0]) + ' · 6 店</div></div>' +
        '<button type="button" class="pts" data-act="points"><i></i><b>' + D.points.balance + '</b></button>' +
      '</div>' +

      '<div class="today">' +
        '<div class="today__kicker"><i>军</i><span>AI 军师 · 今天该做的一件事</span></div>' +
        '<div class="today__t">' + esc(A.title) + '</div>' +
        '<div class="today__b">' + esc(A.body) + '</div>' +
        '<div class="today__cta">' +
          '<button type="button" class="btn btn--gold" data-act="go" data-to="/produce">' + esc(A.cta) + '</button>' +
          '<button type="button" class="btn btn--onink" data-act="go" data-to="/report">' + esc(A.ctaAlt) + '</button>' +
        '</div>' +
      '</div>' +

      '<div class="card" style="padding:15px">' +
        '<div class="rowb"><h2 class="serif" style="font-size:15px">我的经营主线</h2>' +
        '<span class="note">本周 · 第 ' + L.stuckAt + ' 步卡住了</span></div>' +
        '<div class="rail">' + rail + '</div>' +
        '<div class="steps">' + steps + '</div>' +
        '<div class="note--amber"><i></i><p>' + esc(L.hint) + '</p></div>' +
      '</div>' +

      '<div class="duo">' + stats + '</div>' +

      '<div class="card" style="padding:15px">' +
        '<h2 class="serif" style="font-size:15px;margin-bottom:12px">常用</h2>' +
        '<div class="grid4">' + sc + '</div>' +
      '</div>' +

      '<p class="disclaimer">读数为演示数据。涉及体重管理的表述限于经营与服务流程，不构成疾病诊断、治疗建议或疗效承诺。</p>' +
    '</div>';
  }

  function openPoints() {
    var P = D.points;
    openSheet('积分 · ' + P.balance,
      '<div class="stack g10">' +
        P.rules.map(function (r) {
          return '<div class="card" style="padding:12px 13px">' +
            '<b style="font-size:12.5px">' + esc(r.k) + '</b>' +
            '<p class="note" style="margin-top:4px">' + esc(r.v) + '</p></div>';
        }).join('') +
        '<p class="disclaimer">积分把内容生产成本和消费闭环连在一起：出片扣分、带客赠分、商城抵扣。</p>' +
      '</div>');
  }

  /* ------------------------------------------------------- B9 出片模板库 */
  function viewStudio() {
    var S = D.sharedScript;
    var cats = D.templateTabs.map(function (c) {
      return '<button type="button" class="cat' + (state.cat === c ? ' cat--on' : '') +
        '" data-act="cat" data-c="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');

    var list = D.templates.filter(function (t) { return t.tab === state.cat; });
    var tpls = list.length ? list.map(function (t) {
      return '<button type="button" class="card tpl" data-act="go" data-to="/produce">' +
        '<div class="cov cov--sq cov--' + t.cov + '"><span class="cov__n">片</span>' +
          '<span class="cov__dur">' + esc(t.dur) + '</span></div>' +
        '<div class="tpl__foot">' +
          '<div class="tpl__t">' + esc(t.title) + '</div>' +
          '<div class="tpl__n">' + esc(t.note) + '</div>' +
          '<div class="tpl__row"><span class="tpl__cost">' + D.points.clipCost + ' 分 / 条</span>' +
          '<span class="tpl__go">套用 ›</span></div>' +
        '</div></button>';
    }).join('') : '<div class="empty" style="grid-column:1/-1">该分类下暂无模板。</div>';

    return '<div class="pad stack g14">' +
      '<div class="catbar">' + cats + '</div>' +

      '<div class="card drama">' +
        '<div class="cov cov--wide cov--' + S.cov + '">' +
          '<span class="cov__badge">' + esc(S.badge) + '</span>' +
          '<span class="cov__play"></span>' +
          '<span class="cov__dur">' + esc(S.dur) + '</span>' +
        '</div>' +
        '<div class="drama__foot">' +
          '<div class="drama__t">' + esc(S.title) + '</div>' +
          '<div class="drama__b">' + esc(S.body) + '</div>' +
          '<div class="drama__row"><span class="meta">' + esc(S.used) + '</span>' +
          '<button type="button" class="btn btn--vio" data-act="go" data-to="/produce">套用开拍</button></div>' +
        '</div>' +
      '</div>' +

      '<div class="tpls">' + tpls + '</div>' +

      '<p class="disclaimer">模板与用量为演示数据。套用模板生成的成片自带 AI 生成标识。内容发布前须经人工审核，不得出现减重效果、疗效或治愈类表述。</p>' +
    '</div>';
  }

  /* ------------------------------------------------------- B10 出片与分发 */
  function viewProduce() {
    var P = D.produce, ss = P.selfServe;
    var on = state.selfServe;

    var flow = P.steps.map(function (s, i) {
      return '<div class="flowrow"><div class="flowrow__rail"><i>' + (i + 1) + '</i><span></span></div>' +
        '<div class="flowrow__b">' + esc(s) + '</div></div>';
    }).join('');

    var chans = P.channels.map(function (c) {
      return '<div class="chan"><span class="chan__d"></span>' +
        '<span class="chan__n">' + esc(c.name) + '</span>' +
        (c.tag ? '<span class="chan__tag">AI ' + esc(c.tag) + '</span>' : '') +
        '<span class="chan__c">' + esc(c.count) + '</span></div>';
    }).join('');

    var pct = Math.round(P.done / P.total * 100);

    return '<div class="pad stack g14">' +
      '<div class="stack g5">' +
        '<h2 class="serif" style="font-size:17px">' + esc(P.templateName) + '</h2>' +
        '<p class="note">今天这一批 6 条，扣 ' + (D.points.clipCost * 6) + ' 分</p>' +
      '</div>' +

      '<div class="card" style="padding:15px"><div class="flow">' + flow + '</div></div>' +

      '<div class="card" style="padding:15px;gap:9px;display:flex;flex-direction:column">' +
        '<div class="rowb"><b style="font-size:13px">后台生成中</b>' +
        '<span class="note" id="pd-n">' + P.done + ' / ' + P.total + ' 条</span></div>' +
        '<div class="prog2"><i id="pd-bar" style="width:' + pct + '%"></i></div>' +
        '<div class="spend"><span>可以退出去接客人，好了通知你</span>' +
        '<b id="pd-sp">已耗 ' + (P.done * D.points.clipCost) + ' 分</b></div>' +
      '</div>' +

      '<div class="card" style="padding:6px 15px">' + chans + '</div>' +

      '<div class="selfserve' + (on ? '' : ' selfserve--off') + '">' +
        '<div class="selfserve__h">' +
          '<span class="selfserve__t">' + esc(on ? ss.title : ss.offTitle) + '</span>' +
          '<button type="button" class="sw' + (on ? ' sw--on' : '') + '" data-act="selfserve" ' +
            'role="switch" aria-checked="' + on + '" aria-label="客户自助出片"></button>' +
        '</div>' +
        '<p class="selfserve__b">' + (on
          ? esc(ss.pre) + '<b>' + esc(ss.bold) + '</b>' + esc(ss.post)
          : esc(ss.offBody)) + '</p>' +
        (on ? '<p class="selfserve__b" style="margin-top:6px">' + esc(ss.key) + '</p>' : '') +
      '</div>' +

      '<p class="disclaimer">生成与分发为演示流程，收益数字为模拟值，不构成收入承诺。生成内容按《人工智能生成合成内容标识办法》添加显式角标与文件隐式标识，分发前不得去除。客户影像用于内容制作需单独取得授权，不得用于效果对比宣传。</p>' +
    '</div>';
  }

  var pdTimer = null;
  function mountProduce() {
    clearInterval(pdTimer);
    var P = D.produce, cur = P.done;
    if (reduceMotion || cur >= P.total) return;
    pdTimer = setInterval(function () {
      var bar = $('#pd-bar');
      if (!bar) { clearInterval(pdTimer); pdTimer = null; return; }
      cur++;
      bar.style.width = Math.round(cur / P.total * 100) + '%';
      var n = $('#pd-n'); if (n) n.textContent = cur + ' / ' + P.total + ' 条';
      var sp = $('#pd-sp'); if (sp) sp.textContent = '已耗 ' + (cur * D.points.clipCost) + ' 分';
      if (cur >= P.total) {
        clearInterval(pdTimer); pdTimer = null;
        toast('6 条已生成，机器人开始按点推进客户群');
      }
    }, 1400);
  }

  /* ------------------------------------------------------- B11 数字资产库 */
  function viewAssets() {
    var A = D.assets, p = A.persona;

    var tabs = A.tabs.map(function (t, i) {
      return '<button type="button" class="astab' + (state.asTab === i ? ' astab--on' : '') +
        '" data-act="astab" data-i="' + i + '"><b>' + t.n + '</b><span>' + esc(t.name) + '</span></button>';
    }).join('');

    var eras = p.eras.map(function (e) {
      return '<div class="era' + (e.active ? ' era--on' : '') + '">' +
        '<div class="era__box cov--' + e.cov + '">' + esc(p.name.slice(0, 1)) + '</div>' +
        '<div class="era__y">' + esc(e.year) + '</div></div>';
    }).join('');

    function rows(list) {
      return list.map(function (s) {
        return '<div class="asrow"><span class="asrow__th cov--' + s.cov + '"></span>' +
          '<div style="min-width:0"><div class="asrow__t">' + esc(s.name) + '</div>' +
          '<div class="asrow__m">' + esc(s.meta) + '</div></div></div>';
      }).join('');
    }

    var body;
    if (state.asTab === 0) {
      body = '<div class="card persona">' +
          '<div class="persona__top">' +
            '<span class="persona__av">' + esc(p.name.slice(0, 1)) + '</span>' +
            '<div style="flex:1;min-width:0"><div class="persona__n">' + esc(p.name) + '</div>' +
            '<div class="persona__reg">' + esc(p.reg) + '</div>' +
            '<div class="persona__reg">' + esc(p.verified) + '</div>' +
            '<div class="persona__reg">' + esc(p.term) + '</div></div>' +
            '<span class="persona__st">' + esc(p.status) + '</span>' +
          '</div>' +
          '<div class="eras">' + eras + '</div>' +
          '<p class="note">' + esc(p.note) + '</p>' +
        '</div>';
    } else if (state.asTab === 1) {
      body = '<div class="card" style="padding:4px 15px">' + rows(A.scenes) + '</div>';
    } else if (state.asTab === 2) {
      body = '<div class="card" style="padding:4px 15px">' + rows(A.products) + '</div>';
    } else {
      body = '<div class="card" style="padding:15px">' +
        '<div class="asrow" style="border:0;padding:6px 0">' +
          '<span class="asrow__th cov--a"></span>' +
          '<div style="min-width:0"><div class="asrow__t">' + esc(A.voice.name) + '</div>' +
          '<div class="asrow__m">' + esc(A.voice.meta) + '</div></div>' +
        '</div>' +
        '<p class="note" style="margin-top:8px">' + esc(A.voice.rest) + '</p>' +
      '</div>';
    }

    return '<div class="pad stack g14">' +
      '<div class="stack g5">' +
        '<h2 class="serif" style="font-size:17px">拍一次，反复用</h2>' +
        '<p class="note">' + esc(A.total) + '</p>' +
      '</div>' +
      '<div class="astabs">' + tabs + '</div>' +
      body +
      '<div class="lend"><span class="lend__i">借</span>' +
        '<div><b>' + esc(A.lend.title) + '</b><span>' + esc(A.lend.body) + '</span></div></div>' +
      '<p class="disclaimer">形象、音色与客户影像均建立授权台账，记录权利人、核验方式、使用范围与有效期；过期即停用。</p>' +
    '</div>';
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

    /* 合规口径必须常驻：免费档也要看得到，不能锁在付费板块里 */
    var caveat = '<div class="disclaimer" style="line-height:1.95;font-size:11.5px">' + esc(R.caveat) + '</div>';

    var tail;
    if (locked) {
      tail = '<div class="locked">' +
          '<span class="locked__ico"><i></i></span>' +
          '<div><b>后续 1 个板块为会员内容</b>' +
          '<p>90 天行动路线图<br>升级学习会员后解锁，并可预约 1 对 1 复盘</p></div>' +
          '<button type="button" class="btn btn--gold" data-act="go" data-to="/plans">查看会员方案</button>' +
        '</div>' +
        caveat;   /* 免费档不带编号，避免出现 03 → 05 的断号 */
    } else {
      var s4 = sec('04', '90 天行动路线', '<div class="tl">' + R.phases.map(function (p) {
        return '<div class="tl__row"><div class="tl__rail"><i style="background:' + p.dot + '"></i><span></span></div>' +
          '<div class="tl__body"><div class="tl__t"><b>' + esc(p.t) + '</b><em>' + esc(p.range) + '</em></div>' +
          '<div class="tl__d">' + esc(p.d) + '</div></div></div>';
      }).join('') + '</div>');

      tail = s4 + sec('05', '前提与口径', caveat) +
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

        /* 超级店长 / 财务官在消息列表里对免费档是锁着的，这里的产出也必须跟着锁，
           否则「点不开智能体但看得到它的产出」自相矛盾 */
        (isFree()
          ? '<div class="locked">' +
              '<span class="locked__ico"><i></i></span>' +
              '<div><b>机器人日志与军师提醒为会员内容</b>' +
              '<p>超级店长每天替你干了什么、今晚该回访谁<br>升级学习会员后解锁</p></div>' +
              '<button type="button" class="btn btn--gold" data-act="go" data-to="/plans">查看会员方案</button>' +
            '</div>'
          : '<div class="stack g10">' +
              '<span class="label">群机器人今天干了什么</span>' +
              '<div class="card" style="padding:5px 15px"><div class="botlog">' +
                D.botLog.map(function (b) {
                  return '<div class="botrow"><span class="botrow__t">' + esc(b.t) + '</span>' +
                    '<span class="botrow__s">' + esc(b.s) + '</span></div>';
                }).join('') +
              '</div></div>' +
            '</div>' +

            '<div class="remind">' +
              '<div class="remind__h"><i>军</i><b>军师今日提醒</b></div>' +
              '<p>' + esc(D.remind) + '</p>' +
              '<div class="remind__row">' +
                '<button type="button" data-act="callbacks">查看名单</button>' +
                '<button type="button" class="is-gold" data-act="send-callbacks">确认发送</button>' +
              '</div>' +
            '</div>') +

        '<p class="disclaimer">门店数据为演示数据。真实接入需门店授权，客户健康数据的采集与使用需单独取得同意；回访触达前需客户已同意接收，且每条均可退订。</p>' +
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

    /* 弹层里的跳转要先收起弹层，否则新页面会被 sheet 盖住 */
    if (act === 'go') { closeSheet(); go(el.getAttribute('data-to')); }
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
    else if (act === 'pz') openPeek(el.getAttribute('data-id'));
    else if (act === 'unlock') unlockPlaza(el.getAttribute('data-id'));
    else if (act === 'points') openPoints();
    else if (act === 'cat') { state.cat = el.getAttribute('data-c'); render(); }
    else if (act === 'astab') { state.asTab = +el.getAttribute('data-i'); render(); }
    else if (act === 'selfserve') {
      state.selfServe = !state.selfServe;
      save('selfServe', state.selfServe);
      render();
      toast(state.selfServe
        ? '已开启：客户扫码出片 9.9 元一条，客资直接进门店池子'
        : '已关闭：拉新回到纯成本，客资留在店长微信里');
    }
    else if (act === 'daily') openDaily();
    else if (act === 'daily-share') { closeSheet(); toast('群报已转发（演示）·新成员扫码即进入注册流程'); }
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
