import profile from "../data/profile.md";
import { chat, type ChatEnv } from "./chat";

interface Env extends ChatEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/chat" || pathname === "/api/chat/") return chat(request, env, profile);
    if (pathname.startsWith("/api/")) return new Response("Not found", { status: 404 });
    return env.ASSETS.fetch(request);
  },
};

export default worker;
