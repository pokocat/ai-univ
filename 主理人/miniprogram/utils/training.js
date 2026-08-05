/**
 * 培训 phase 的展示口径（首页入口卡 / 「我的」菜单副标题 / 社群提示条共用）。
 *
 * 抽出来的原因不是「少写几行」，而是这三处都要处理**同一个例外**：
 * 运营轨已分班（phase 仍是 add_advisor）时，只有推荐人轨会在分班时为学员生成本人专属的
 * 企微「联系我」配置，运营轨学员没有顾问可加。后端已按轨道分开给文案（不再让运营轨去加顾问），
 * 但它的 `hint` 指向「加入班级群」或「等专属客服联系」——这三处都只是**入口标签**，
 * 渲染不了群码，照抄会把用户按到一个本页不存在的动作上，故仍用本模块的简短替代文案，
 * 由 pages/training 与「我的社群」承担真正的入群引导（详见 pages/training/index.js 的 opsPlaced 注释）。
 * 三处各写一份，迟早有一处忘了这个例外。
 *
 * 轨道判定依据：`training_enrollment.referrer_member_id` 非空 = 推荐人轨（后端 resolveTrack 的写法），
 * 而顾问码只在推荐人轨的 assign 里生成，两者等价。后端另有权威字段 `track`（REFERRER/OPS），
 * 此处仍用 referrer_member_id：老后端的响应没有 track，而这段代码要能跑在两者之上。
 */

/** phase → 状态标签（首页 tag / 菜单副标题） */
const PHASE_LABEL = {
  waiting_assign: "等待分班",
  add_advisor: "待加班级顾问",
  join_group: "待加入班级群",
  in_cohort: "在训",
};

/** phase → 社群页提示条前半句（本页语义是会员费社群，班级进度在培训页） */
const PHASE_TIP = {
  waiting_assign: "你有培训报名正在等待分班",
  add_advisor: "你的培训班级已安排，待添加班级顾问",
  join_group: "你的班级群已就绪，待加入",
  in_cohort: "你正在培训班级中",
};

/** 运营轨已分班的替代文案（不提「加顾问」，不指向学员没有的入口） */
const OPS_PLACED = {
  label: "已分班",
  hint: "本次分班由运营安置，入群由专属客服与你对接",
  tip: "你的培训班级已安排",
};

/**
 * 把 /mp/training/enrollment 的响应压成入口展示所需的三段文案。
 * @param {object} t 接口 data 原样
 * @returns {null|{phase:string,label:string,hint:string,tip:string}} 无在途报名返回 null（入口不出现）
 */
function summary(t) {
  const phase = t && t.phase;
  if (!phase || phase === "none") return null;
  const e = (t && t.enrollment) || {};
  const ops = phase === "add_advisor" && !e.referrer_member_id;
  return {
    phase,
    label: ops ? OPS_PLACED.label : PHASE_LABEL[phase] || phase,
    hint: ops ? OPS_PLACED.hint : t.hint || "",
    tip: ops ? OPS_PLACED.tip : PHASE_TIP[phase] || "",
  };
}

module.exports = { summary, PHASE_LABEL, PHASE_TIP, OPS_PLACED };
