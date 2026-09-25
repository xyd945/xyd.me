import { readFile, stat } from "node:fs/promises";
import { resolve, dirname, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { imageTypes, validateImages, saveStory, errorMessage, type StoryImage } from "../lib/story-media.ts";
import { validatePost, type Post } from "../lib/posts.ts";

export async function readStory(filename: string) {
  const path = resolve(filename);
  const input = JSON.parse(await readFile(path, "utf8"));
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("The story file must contain a JSON object.");
  for (const field of ["title", "body", "excerpt", "category", "cover", "date", "link_url"]) {
    if (input[field] !== undefined && typeof input[field] !== "string") throw new Error(`${field} must be text.`);
  }
  for (const field of ["tags", "images"]) {
    if (input[field] !== undefined && (!Array.isArray(input[field]) || input[field].some((value: unknown) => typeof value !== "string"))) throw new Error(`${field} must be a list of strings.`);
  }
  if (input.metadata !== undefined && (!input.metadata || typeof input.metadata !== "object" || Array.isArray(input.metadata))) throw new Error("metadata must be an object.");
  if (input.pinned !== undefined && typeof input.pinned !== "boolean") throw new Error("pinned must be a boolean.");
  const post: Post = {
    id: crypto.randomUUID(), title: input.title ?? "", body: input.body ?? "", excerpt: input.excerpt ?? "", category: input.category ?? "building", cover: input.cover ?? "note", date: input.date ?? new Date().toISOString().slice(0, 10), link_url: input.link_url ?? "", tags: input.tags ?? [], pinned: input.pinned ?? false, metadata: input.metadata ?? {}, image_url: "", images: [], published: false,
  };
  const invalid = validatePost(post);
  if (invalid) throw new Error(invalid);
  if ((input.images?.length ?? 0) > 10) throw new Error("A story can have up to 10 images.");
  const media: StoryImage[] = [];
  for (const relative of input.images ?? []) {
    const imagePath = resolve(dirname(path), relative);
    const extension = extname(imagePath).slice(1).toLowerCase().replace(/^jpeg$/, "jpg");
    const type = Object.keys(imageTypes).find((type) => imageTypes[type] === extension) ?? "";
    const { size } = await stat(imagePath);
    const error = validateImages([{ type, size }], media.length);
    if (error) throw new Error(`${relative}: ${error}`);
    media.push({ id: String(media.length), url: "", file: new File([await readFile(imagePath)], relative, { type }) });
  }
  const coverIndex = input.coverImage === undefined ? (media.length ? 0 : null) : input.coverImage;
  if (coverIndex !== null && (!Number.isInteger(coverIndex) || coverIndex < 0 || coverIndex >= media.length)) throw new Error("coverImage must be a zero-based image index, or null for a designed cover.");
  return { post, media, coverId: coverIndex === null ? null : String(coverIndex) };
}

async function main() {
  const [mode, filename] = process.argv.slice(2);
  if (!["--check", "--push"].includes(mode) || !filename) throw new Error("Usage: npm run story:check -- path/to/story.json (or story:push)");
  const story = await readStory(filename);
  if (mode === "--check") { console.log(`Valid draft: ${story.post.title} (${story.media.length} images). Nothing uploaded.`); return; }
  try { process.loadEnvFile(".env.local"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key?.startsWith("sb_secret_")) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (sb_secret_…) in .env.local. The secret is used only by this local command.");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.from("site_admins").select("user_id");
  if (error) throw error;
  const owner = process.env.SUPABASE_OWNER_ID ?? (data?.length === 1 ? data[0].user_id as string : undefined);
  if (!owner || !data?.some((row) => row.user_id === owner)) throw new Error("Add your owner to site_admins first. With multiple owners, set SUPABASE_OWNER_ID to the intended owner UUID.");
  const saved = await saveStory(client, owner, story.post, story.media, story.coverId, console.log);
  console.log(`Draft saved: ${saved.id}\nReview locally: /admin/?edit=${saved.id}\nNothing published. Open the studio to edit the story, cover, tags and category.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(errorMessage(error)); process.exitCode = 1; });
}
