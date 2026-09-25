import type { ChatMessage } from "@/lib/prompt";

export function MessageLine({ role, content }: ChatMessage) {
  return <div className="terminal-message"><span className={role === "user" ? "terminal-visitor" : "terminal-kitt"}>{role === "user" ? "visitor" : "kitt"}@xyd.me:</span><span className="terminal-path">$ ~ </span><span>{content}</span></div>;
}
