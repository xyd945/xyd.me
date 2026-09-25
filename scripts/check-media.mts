import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { postImages, type Post } from "../lib/posts.ts";
import { validateImages, saveStory } from "../lib/story-media.ts";
import { readStory } from "./story.mts";

assert.equal(validateImages([{ size: 12, type: "image/png" }], 9), null);
assert.ok(validateImages([{ size: 12, type: "image/png" }], 10));
assert.ok(validateImages([{ size: 0, type: "image/png" }]));
assert.ok(validateImages([{ size: 12, type: "image/svg+xml" }]));
assert.ok(validateImages([{ size: 8 * 1024 * 1024 + 1, type: "image/jpeg" }]));
const post: Post = { id: crypto.randomUUID(), title: "A chapter", body: "Story", excerpt: "", category: "building", cover: "note", date: "2026-09-25", tags: ["one", "one", " two "], images: [], image_url: "", link_url: "", pinned: false, published: false, metadata: {} };
assert.deepEqual(postImages({ ...post, image_url: "https://example.com/b.jpg", images: ["https://example.com/a.jpg", "https://example.com/b.jpg"] }), ["https://example.com/b.jpg", "https://example.com/a.jpg"]);
const media = [0, 1].map((i) => ({ id: String(i), url: "blob:preview", file: new File(["image bytes"], `${i}.png`, { type: "image/png" }) }));
let paths: string[] = [], removed: string[] = [], written: Post | undefined, failUpload = false, saveError: unknown;
const storage = {
  upload: async (path: string) => { paths.push(path); return { error: failUpload && paths.length === 2 ? new Error("Upload interrupted") : null }; },
  remove: async (items: string[]) => { removed.push(...items); return { error: null }; },
  getPublicUrl: (path: string) => ({ data: { publicUrl: `https://example.com/${path}` } }),
};
const client = { storage: { from: () => storage }, from: () => ({ upsert: (value: Post) => { written = value; return { select: () => ({ single: async () => ({ data: value, error: saveError }) }) }; } }) } as unknown as SupabaseClient;
let saved = await saveStory(client, "owner", post, media, "1");
assert.equal(saved.images.length, 2);
assert.equal(saved.image_url, saved.images[1]);
assert.deepEqual(saved.tags, ["one", "two"]);
assert.ok(paths.every((path) => path.startsWith("owner/") && path.endsWith(".png")));
assert.equal(saved.published, false);
assert.equal(removed.length, 0);
saved = await saveStory(client, "owner", saved, saved.images.map((url) => ({ id: url, url })), null);
assert.equal(saved.image_url, "");
assert.equal(paths.length, 2, "Existing images must not upload again");
paths = []; removed = []; written = undefined; failUpload = true;
await assert.rejects(saveStory(client, "owner", post, media, "0"), /Upload interrupted/);
assert.equal(written, undefined, "Partial uploads must not save a story");
assert.deepEqual(removed, [paths[0]], "Clean up successful uploads from a failed batch");
paths = []; removed = []; failUpload = false; saveError = { code: "42501", message: "Permission denied" };
await assert.rejects(saveStory(client, "owner", post, media, "0"), /Permission denied/);
assert.deepEqual(removed, paths, "Rejected writes must clean up new images");
paths = []; removed = []; saveError = { code: "", message: "Connection lost" };
await assert.rejects(saveStory(client, "owner", post, media, "0"), /save may have completed/);
assert.equal(removed.length, 0, "Ambiguous responses must not delete potentially committed images");
const directory = await mkdtemp(join(tmpdir(), "xyd-story-"));
try {
  const filename = join(directory, "story.json");
  await writeFile(join(directory, "photo.png"), "fixture");
  await writeFile(filename, JSON.stringify({ title: "Agent draft", published: true, images: ["photo.png"], coverImage: 0 }));
  const draft = await readStory(filename);
  assert.equal(draft.post.published, false, "Agent workflow must always create a draft");
  assert.equal(draft.media[0].file?.type, "image/png");
  assert.equal(draft.coverId, "0");
  await writeFile(filename, JSON.stringify({ title: "Invalid", images: ["photo.png"], coverImage: 3 }));
  await assert.rejects(readStory(filename), /coverImage/);
} finally { await rm(directory, { recursive: true, force: true }); }
console.log("PASS: multiple images, chosen cover, limits, rollback, ambiguous writes, local draft-only workflow");
