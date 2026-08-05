/**
 * 我的培训（方案 §6.4）：「等待分班 → 添加班级顾问 → 加入班级群 → 我的班级」四个连续状态
 * 做成**一个页面的四段式视图**，由后端 GET /mp/training/enrollment 的 phase 驱动。
 *
 * 为什么不做四个页面：这四态是同一条链路上的先后时刻，用户每次进来只可能落在其中一态，
 * 拆页会带来「该跳哪一页」的判定与页面栈成本，而后端那个聚合本来就是为单页四态设计的
 * （phase + enrollment + contactWay + hint 一次给全）。
 *
 * 诚实度约定（CLAUDE.md 前端诚实度）：
 * - 阶段推进全部由服务端事件驱动（企微加顾问回调 / 入群回调），本页**只读**，
 *   任何按钮都不会伪造状态；「刷新状态」只是重新拉接口，phase 没变就如实说没变。
 * - 后端没给的字段（企业认证信息、顾问头像）一律不展示，不用占位图硬凑；
 *   有字段但为空的（讲师/开课时间）显示「—」。
 * - 引导文案优先用接口 hint（推荐人轨与运营轨措辞不同，由后端裁定），不在前端另编一套；
 *   唯一例外是运营轨已分班（见 OPS_PLACED_VIEW，后端文案指代一个本页不存在的入口名）。
 */
const api = require("../../api/mp");
const { isAuthGateError } = require("../../utils/auth");
const { d10, toast } = require("../../utils/fmt");
const share = require("../../behaviors/share");
const qrcode = require("../../utils/qrcode");
const wecomJoin = require("../../utils/wecom-join");

/** 进度条四段（方案 §6.4 的四个连续状态，压成短标签） */
const STEP_LABELS = ["分班", "加顾问", "进群", "在训"];
const PHASE_INDEX = { waiting_assign: 0, add_advisor: 1, join_group: 2, in_cohort: 3 };

/**
 * 运营轨已分班压成三段：这条轨道**没有「加顾问」这一步**（顾问码只在推荐人轨分班时生成）。
 * 留着四段就只能在「加顾问」上二选一地撒谎——标成 current 是指一个他做不到的动作，
 * 标成 done 是说一件没发生的事，而卡片标题此时已经是「加入班级群」。
 */
const OPS_STEP_LABELS = ["分班", "进群", "在训"];

/** 主卡标题：口径统一为「班级顾问」，不出现「机器人自动拉群」（方案 §6.4） */
const PHASE_TITLE = {
  waiting_assign: "等待分班",
  add_advisor: "添加班级顾问",
  join_group: "加入班级群",
  in_cohort: "我的班级",
};

/**
 * 运营轨已分班（phase 仍是 add_advisor，但没有本人专属顾问码）的页面自有标题与文案。
 * 不照抄后端 hint 的原因只剩「入口指代」：后端说「请从「加入班级群」入口扫码」，
 * 而本页的官方按钮就在眼前。两种子态分开说——
 * 有插件入口就让他点击，没入口才说等客服对接。
 */
const OPS_PLACED_VIEW = {
  withEntry: { title: "加入班级群", hint: "本次分班由运营安置，点击下方「加入群聊」进入班级群" },
  waiting: { title: "运营安置中", hint: "本次分班由运营安置，入群由专属客服与你对接" },
};

/** 刷新后 phase 没变时的如实说明（不同阶段等的事件不同） */
const NO_CHANGE_TIP = {
  waiting_assign: "班级还在安排中，安排好后这里会自动更新",
  add_advisor: "还没收到顾问添加成功的通知，添加后请稍等几秒再刷新",
  join_group: "还没收到入群成功的通知，进群后这里会自动更新",
  in_cohort: "已是最新状态",
};

/** 分段进度：当前段高亮，之前的段置完成，连接线随进度点亮（运营轨已分班走三段，当前段=进群） */
function buildSteps(phase, opsPlaced) {
  const labels = opsPlaced ? OPS_STEP_LABELS : STEP_LABELS;
  const idx = opsPlaced ? OPS_STEP_LABELS.indexOf("进群") : PHASE_INDEX[phase];
  if (idx === undefined) return [];
  return labels.map((label, i) => ({
    label,
    state: i < idx ? "done" : i === idx ? "current" : "todo",
    linked: i > 0 && i <= idx,
  }));
}

/** 开课周期：起止都有给区间，只有开课日给「起」，都没有给「—」（不写死基准日） */
function periodText(start, end) {
  if (start && end) return `${d10(start)} → ${d10(end)}`;
  if (start) return `${d10(start)} 起`;
  return "—";
}

Page(share.withShare({
  data: {
    loadError: "",
    retrying: false,
    refreshing: false,
    loaded: false,
    phase: "",
    title: "",
    hint: "",
    steps: [],
    /** 报名信息行（全部真实字段，缺失显示 —） */
    info: [],
    /** 班级信息（分班后才有） */
    cohortName: "",
    instructor: "",
    periodText: "",
    groupName: "",
    joinedAtText: "",
    trackText: "",
    statusText: "",
    /** 顾问卡：{name, metaText} —— 后端无姓名时退回「班级顾问」，无认证信息则整段不显示 */
    advisor: null,
    /** 顾问二维码入口（contact-entry） */
    contactAvailable: false,
    contactQr: "",
    contactHint: "",
    contactExpiresText: "",
    /** 运营轨：分班由运营安置、没有顾问码；有官方插件入口则本页自助进群。 */
    opsPlaced: false,
    /** 班级群入口（join-entry） */
    joinAvailable: false,
    joinUrl: "",
    joinHint: "",
  },

  onShow() {
    this.load();
  },

  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },

  /** 错误条重试入口 */
  async retryLoad() {
    if (this.data.retrying) return;
    this.setData({ retrying: true });
    await this.load();
    this.setData({ retrying: false });
  },

  /**
   * 「刷新状态」：阶段推进靠企微回调，用户加完顾问/进完群会想立刻确认。
   * 拉完发现 phase 没变就照实说没变——不做「已提交」这类看不出真假的提示。
   */
  async refreshStatus() {
    if (this.data.refreshing) return;
    const before = this.data.phase;
    // 运营轨已分班等的是入群事件，不是「加顾问成功」——他压根没有顾问可加，
    // 照 phase 取 add_advisor 那句会说一件与他无关的事（load 后 opsPlaced 会被覆盖，先存下来）
    const opsBefore = this.data.opsPlaced;
    this.setData({ refreshing: true });
    await this.load();
    this.setData({ refreshing: false });
    if (this.data.phase === before && !this.data.loadError) {
      toast((opsBefore ? NO_CHANGE_TIP.join_group : NO_CHANGE_TIP[before]) || "已是最新状态");
    }
  },

  async load() {
    if (this.data.loadError) this.setData({ loadError: "" });
    try {
      const data = await api.getTrainingEnrollment();
      const phase = data.phase || "none";
      const e = data.enrollment || null;
      if (phase === "none" || !e) {
        this.setData({
          loaded: true,
          phase: "none",
          title: "尚无培训报名",
          hint: data.hint || "",
          steps: [],
          info: [],
          advisor: null,
          contactAvailable: false,
          joinAvailable: false,
          opsPlaced: false,
        });
        return;
      }

      /**
       * 顾问码只在「加顾问/进群」阶段有意义；官方入群入口在「已分班之后」都可能有：
       * 运营轨已分班（phase 仍是 add_advisor）后端也会放行入口，本页直接展示就不用再绕「我的社群」。
       *
       * 为什么已分班阶段**一律**取一次 join-entry，而不按 `data.track === "OPS"` 省这个请求：
       * ①判轨真正的依据是「有没有发过顾问码」（contact-entry 的 contactWayStatus 是否缺席），
       *   而归属转交会把运营轨报名的 track 改成 REFERRER 却不追发顾问码——按 track 判会正好漏掉这类；
       * ②contact-entry 与 join-entry 是并发的，想先判轨再决定就得串成两跳。
       * 两个 GET 都是只读无副作用，宁可多打一个，不为省一次请求换来判错轨或多一跳等待。
       */
      const needContact = phase === "add_advisor" || phase === "join_group";
      const needJoin = phase === "add_advisor" || phase === "join_group" || phase === "in_cohort";
      const [contact, join] = await Promise.all([
        needContact ? api.getTrainingContactEntry() : Promise.resolve(null),
        needJoin ? api.getTrainingJoinEntry() : Promise.resolve(null),
      ]);

      const info = [
        { k: "培训套餐", v: e.plan_name || "—" },
        { k: "订单号", v: e.order_no || "—" },
        { k: "报名时间", v: e.created_at ? d10(e.created_at) : "—" },
        { k: "报名状态", v: e.status || "—" },
      ];
      if (e.referrer_name) info.push({ k: "班主任（推荐人）", v: e.referrer_name });
      if (e.cohort_code) info.push({ k: "班级编号", v: e.cohort_code });

      // 顾问展示信息：姓名缺失退回「班级顾问」；服务区域/部门有才拼，认证信息后端没有就不显示
      const ap = (contact && contact.advisor) || null;
      const advisor = needContact
        ? {
            name: (ap && ap.name) || "班级顾问",
            char: ((ap && ap.name) || "顾").charAt(0),
            metaText: ap ? [ap.service_region, ap.department].filter(Boolean).join(" · ") : "",
          }
        : null;

      // contactWayStatus 只在存在「联系我」配置时才有：没有 = 运营轨安置（沿既有入群链路，无顾问码）
      const opsPlaced = phase === "add_advisor" && !!contact && !contact.contactWayStatus;
      // scene=1 官方插件入口可用 = 后端放行且真给了 url；scene=2 活码图片绝不再进本页。
      const joinAvailable = !!(join && join.available && join.joinUrl);
      const ops = opsPlaced ? (joinAvailable ? OPS_PLACED_VIEW.withEntry : OPS_PLACED_VIEW.waiting) : null;

      this.setData({
        loaded: true,
        phase,
        title: ops ? ops.title : PHASE_TITLE[phase] || "我的培训",
        hint: ops ? ops.hint : data.hint || "",
        steps: buildSteps(phase, opsPlaced),
        info,
        cohortName: e.cohort_name || "—",
        instructor: e.instructor || "—",
        periodText: periodText(e.start_date, e.end_date),
        groupName: e.group_name || "—",
        joinedAtText: e.joined_at ? d10(e.joined_at) : "",
        trackText: e.referrer_name
          ? `班主任（推荐人）${e.referrer_name}`
          : "由运营为你安排班级",
        statusText: e.status || "",
        advisor,
        contactAvailable: !!(contact && contact.available && contact.qrcodeUrl),
        contactQr: (contact && contact.qrcodeUrl) || "",
        contactHint: (contact && contact.hint) || "",
        contactExpiresText: contact && contact.expiresAt ? d10(contact.expiresAt) : "",
        opsPlaced,
        joinAvailable,
        joinUrl: (join && join.joinUrl) || "",
        joinHint: (join && join.hint) || "",
      });
    } catch (err) {
      if (isAuthGateError(err)) return; // 未同意协议：已跳登录页，不再打扰
      this.setData({ loadError: err.message, retrying: false });
      toast(err.message);
    }
  },

  goHome() { wx.switchTab({ url: "/pages/index/index" }); },
  goGroup() { wx.switchTab({ url: "/pages/group/index" }); },
  goCourses() { wx.navigateTo({ url: "/pages/courses/index" }); },

  handleJoinComplete(event) { wecomJoin.complete(event); },
  previewContactQR() { qrcode.preview(this.data.contactQr); },
}));
