import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "AI Univ · H5 产品设计预览", description: "主理人与温泉小程序的浏览器设计预览" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="zh-CN"><body>{children}</body></html>; }
