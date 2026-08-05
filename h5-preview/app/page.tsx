"use client";

import { useMemo, useState } from "react";

type Project = "host" | "spring";

const hostScreens = ["首页", "社群", "会员", "我的"];
const springScreens = ["主线", "诊断", "出片", "资产", "社群", "我的"];

function HostScreen({ screen }: { screen: string }) {
  if (screen === "会员") return <>
    <div className="mini-nav"><span>‹</span><b>会员中心</b><span>···</span></div>
    <section className="member-card"><span>主理人公社</span><strong>年度会员</strong><p>有效期至 2027.08.05</p><button>查看权益</button></section>
    <h3>专属会员权益</h3><div className="perk-grid">{["AI 军师", "线下活动", "优质课程", "社群服务"].map((x, i) => <div className="perk" key={x}><i>{["✦", "◎", "▣", "◌"][i]}</i>{x}<small>随时可用</small></div>)}</div>
    <div className="white-card"><b>会员服务</b><p>有任何问题，联系你的专属服务顾问</p></div>
  </>;
  if (screen === "社群") return <>
    <div className="mini-nav"><span>‹</span><b>社群</b><span>＋</span></div>
    <h1 className="screen-title">和同路人，一起变得更好</h1><p className="muted">活动、课程与每日值得一读的内容</p>
    {["本周主理人圆桌 · 经营中的关键一问", "正在进行：品牌定位共创营", "今日推荐 · 如何把经验变成可复制的系统"].map((x, i) => <article className="feed" key={x}><div className={`feed-pic p${i}`}></div><div><b>{x}</b><p>主理人公社 · {i + 2} 小时前</p><span>查看详情 →</span></div></article>)}
  </>;
  if (screen === "我的") return <>
    <div className="mini-nav transparent"><span>‹</span><b>我的</b><span>···</span></div><section className="profile"><div className="avatar">林</div><div><h2>林女士</h2><p>主理人公社 · 年度会员</p></div><span>›</span></section>
    <div className="stat-row"><div><b>12</b><span>我的课程</span></div><div><b>286</b><span>成长积分</span></div><div><b>3</b><span>我的订单</span></div></div>
    <div className="white-card menu">{["我的会员", "我的活动", "邀请好友", "设置与帮助"].map(x => <p key={x}>{x}<span>›</span></p>)}</div>
  </>;
  return <>
    <div className="mini-nav transparent"><span>●</span><b>主理人公社</b><span>···</span></div>
    <p className="eyebrow">WELCOME TO THE COMMUNITY</p><h1 className="hero-title">让热爱，成为一门<br/>可持续的事业</h1><p className="hero-copy">与一群有行动力的主理人，在真实的商业现场里共同生长。</p><button className="primary">开启我的成长之旅 <span>→</span></button>
    <section className="course-card"><div><small>本周推荐课程</small><h3>找到你的<br/>主理人表达</h3><span>立即学习 →</span></div><div className="orb">✦</div></section>
    <h3 className="section-title">为你推荐</h3><div className="chips"><span>最新活动</span><span>实战课程</span><span>行业洞见</span></div>
  </>;
}

function SpringScreen({ screen }: { screen: string }) {
  if (screen === "诊断") return <><div className="spring-nav"><b>AI 军师</b><span>⋯</span></div><div className="diagnosis-hero"><p>经营诊断</p><h1>看见问题，也看见机会</h1><span>为温泉业务生成一份行动建议</span><button>开始 AI 诊断</button></div><h3>本周经营信号</h3><div className="signal"><b>+18%</b><span>周末家庭客群增长</span><i>↗</i></div><div className="signal"><b>72</b><span>会员复购机会待跟进</span><i>→</i></div></>;
  if (screen === "出片") return <><div className="spring-nav"><b>AI 出片</b><span>···</span></div><h1 className="spring-title">把好内容，变成<br/>会生意的好作品</h1><div className="template-tabs"><span>推荐</span><span>亲子</span><span>疗愈</span><span>节气</span></div><div className="template-grid"><div className="template family"><span>亲子温泉日</span></div><div className="template wellness"><span>疗愈慢生活</span></div></div><button className="spring-button">＋ 新建一条内容</button></>;
  if (screen === "资产") return <><div className="spring-nav"><b>数字资产</b><span>＋</span></div><div className="asset-stat"><small>本月沉淀资产</small><strong>128 <em>个</em></strong><span>较上月 + 26%</span></div><h3>最近使用</h3>{["暑期亲子套餐主视觉", "立秋节气海报", "温泉疗愈短片"].map((x, i) => <div className="asset" key={x}><div className={`asset-img a${i}`}></div><div><b>{x}</b><p>更新于今天</p></div><span>···</span></div>)}</>;
  if (screen === "社群") return <><div className="spring-nav"><b>拉新 · 私域</b><span>···</span></div><div className="crowd-card"><small>本周新增客资</small><strong>46</strong><p>扫码入群率 <b>68%</b></p></div><h3>客群运营</h3>{["亲子家庭 · 82 人", "疗愈度假 · 56 人", "高频复购 · 31 人"].map((x, i) => <div className="audience" key={x}><i>{["亲", "愈", "星"][i]}</i><div><b>{x}</b><p>查看运营建议</p></div><span>›</span></div>)}</>;
  if (screen === "我的") return <><div className="spring-nav"><b>温泉经营</b><span>⚙</span></div><div className="business-profile"><div className="business-logo">泉</div><div><h2>云岚温泉酒店</h2><p>已接入 AI 经营助手</p></div></div><div className="revenue"><span>本月经营账</span><strong>¥ 128,960</strong><p>较上月 <b>+ 12.8%</b></p></div><div className="white-spring">经营目标<span>本月完成 78%　›</span></div><div className="white-spring">会员权益<span>查看详情　›</span></div></>;
  return <><div className="spring-nav"><b>温泉 AI 超级应用</b><span>⌁</span></div><p className="spring-eyebrow">GOOD MORNING, YUNLAN</p><h1 className="spring-title">今天，让经营<br/>更有把握</h1><div className="summary"><span>今日营业额</span><strong>¥ 8,620</strong><em>↗ 16.4%</em><small>比昨日同一时段</small></div><h3>经营主线</h3><div className="mainline"><span>01</span><div><b>暑期亲子客群增长计划</b><p>还有 3 个待办，完成后可生成推广内容</p></div><i>›</i></div><div className="mainline"><span>02</span><div><b>会员复购唤醒</b><p>AI 已为你筛选 72 位高意向会员</p></div><i>›</i></div></>;
}

export default function Home() {
  const [project, setProject] = useState<Project>("host");
  const [screen, setScreen] = useState("首页");
  const screens = project === "host" ? hostScreens : springScreens;
  const title = project === "host" ? "主理人公社" : "温泉 AI 超级应用";
  const subtitle = project === "host" ? "会员成长与社群运营" : "温泉酒店 AI 经营助手";
  const caption = useMemo(() => `${title} · ${screen}`, [title, screen]);
  const selectProject = (next: Project) => { setProject(next); setScreen(next === "host" ? "首页" : "主线"); };
  return <main className={`studio ${project}`}>
    <header><div className="brand"><span>AI</span><div><b>AI Univ</b><small>产品设计预览</small></div></div><div className="project-switch"><button className={project === "host" ? "active" : ""} onClick={() => selectProject("host")}>主理人</button><button className={project === "spring" ? "active" : ""} onClick={() => selectProject("spring")}>温泉</button></div><p>H5 Design Preview</p></header>
    <section className="workspace"><aside><p className="label">项目</p><h2>{title}</h2><span className="sub">{subtitle}</span><p className="label screens-label">页面</p><nav>{screens.map(item => <button className={screen === item ? "selected" : ""} key={item} onClick={() => setScreen(item)}><span>{item === screen ? "●" : "○"}</span>{item}</button>)}</nav><div className="aside-note"><span>Browser ready</span><b>无需微信开发者工具</b><small>点击页面名称切换预览</small></div></aside>
      <section className="stage"><div className="stage-copy"><span>{project === "host" ? "01" : "02"} / PRODUCT DESIGN</span><h1>{caption}</h1><p>在浏览器中浏览页面布局、文字、色彩与关键交互状态。</p></div><div className="phone-wrap"><div className="phone"><div className="dynamic-island"></div><div className="phone-screen">{project === "host" ? <HostScreen screen={screen} /> : <SpringScreen screen={screen} />}</div><div className="home-bar"></div></div><p className="device-caption">iPhone 15 Pro · 393 × 852</p></div></section>
    </section>
  </main>;
}
