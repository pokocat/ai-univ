/**
 * 收益页（对齐设计稿 EarningsTab）：收益镜像（SPEC §2.2 只读）+ 提现申请（审批协同，底部弹层）。
 * 提现流程：申请 → PC 审批中心 → 外部系统打款；中台不执行打款。
 */
const api = require("../../api/mp");
const { isAuthGateError } = require("../../utils/auth");
const { money, d16, toast } = require("../../utils/fmt");
const share = require("../../behaviors/share");

const METHODS = ["微信", "支付宝", "银行卡"];
const STATUS_TAG = { 待审核: "tag", 已批准: "tag tag--amber", 已打款: "tag tag--green", 已拒绝: "tag tag--red" };

Page(share.withShare({
  data: {
    loadError: "",
    retrying: false,
    withdrawable: 0,
    withdrawableText: "0",
    syncText: "",
    stats: [],
    withdrawals: [],
    canWithdraw: false,
    // 提现表单
    formOpen: false,
    amount: "",
    valid: false,
    hintText: "审批通过后由项目方系统打款",
    hintError: false,
    methods: METHODS,
    methodIdx: 0,
    account: "",
    submitting: false,
    idemKey: "",
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
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

  async load() {
    if (this.data.loadError) this.setData({ loadError: "" });
    try {
      const data = await api.getEarnings();
      const withdrawable = Number(data.summary.withdrawable || 0);
      this.setData({
        withdrawable,
        withdrawableText: money(withdrawable),
        canWithdraw: withdrawable >= 100,
        syncText: data.summary.synced_at ? ` · 同步于 ${d16(data.summary.synced_at)}` : "",
        stats: [
          { label: "累计收益（预估）", value: `¥${money(data.summary.total_est)}` },
          { label: "待结算", value: `¥${money(data.summary.pending)}` },
          { label: "已提现", value: `¥${money(data.paidOut)}` },
          { label: "冻结中", value: `¥${money(data.summary.frozen)}` },
        ],
        withdrawals: (data.withdrawals || []).map(w => ({
          id: w.id,
          label: `提现至${w.method} ¥${money(w.amount)}`,
          timeText: d16(w.created_at),
          statusText: w.status,
          tagClass: STATUS_TAG[w.status] || "tag",
          paid: w.status === "已打款",
        })),
      });
    } catch (e) {
      if (isAuthGateError(e)) return; // 未同意协议：已跳登录页，不再打扰
      this.setData({ loadError: e.message, retrying: false });
      toast(e.message);
    }
  },

  openForm() {
    if (!this.data.canWithdraw) return;
    // 幂等键：一次填单一个键，重复点提交只受理一次
    this.setData({
      formOpen: true,
      amount: "",
      account: "",
      methodIdx: 0,
      valid: false,
      hintText: "审批通过后由项目方系统打款",
      hintError: false,
      idemKey: `mpwd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    });
  },
  closeForm() { this.setData({ formOpen: false }); },

  onAmount(e) {
    const amount = e.detail.value;
    const n = Number(amount);
    const valid = Number.isInteger(n) && n >= 100 && n <= this.data.withdrawable;
    this.setData({
      amount,
      valid,
      hintError: !!amount && !valid,
      hintText: amount && !valid
        ? `请输入 100-${this.data.withdrawable} 之间的整数金额`
        : "审批通过后由项目方系统打款",
    });
  },
  onMethod(e) { this.setData({ methodIdx: Number(e.detail.value) }); },
  onAccount(e) { this.setData({ account: e.detail.value }); },

  async submit() {
    if (!this.data.valid || this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      const r = await api.applyWithdrawal(
        Number(this.data.amount),
        METHODS[this.data.methodIdx],
        this.data.account || undefined,
        this.data.idemKey
      );
      this.setData({ formOpen: false });
      wx.showToast({ title: r.message || "提现申请已提交", icon: "success" });
      await this.load();
    } catch (e) {
      toast(e.message);
    } finally {
      this.setData({ submitting: false });
    }
  },
}));
