import type { Metadata } from "next";
import Terminal from "@/components/Terminal";

export const metadata: Metadata = {
  title: "Terminal — Yudi Xu",
  description: "The original xyd.me terminal. Ask KITT about Yudi’s work, projects, and adventures.",
};
export default function TerminalPage() { return <Terminal/>; }
