declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_SUPABASE_URL?: string;
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  }
}

// Wrangler bundles the legacy terminal profile as a server-side text module.
declare module "*.md" {
  const content: string;
  export default content;
}
