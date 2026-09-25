import type { SupabaseClient } from "@supabase/supabase-js";
import { validatePost, type Post } from "./posts.ts";

export const imageTypes: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "image/avif": "avif", "image/gif": "gif",
};
export interface StoryImage { id: string; url: string; file?: File }
export function validateImages(files: Pick<File, "size" | "type">[], existing = 0): string | null {
  if (files.length + existing > 10) return "A story can have up to 10 images.";
  if (files.some((file) => !Object.hasOwn(imageTypes, file.type) || file.size === 0 || file.size > 8 * 1024 * 1024))
    return "Choose JPG, PNG, WebP, AVIF or GIF images, up to 8 MB each.";
  return null;
}
export function errorMessage(error: unknown): string {
  return typeof error === "object" && error && "message" in error ? String(error.message) : "Something went wrong. Your edits are still here.";
}

// Both the studio and local agent use this upload → save path.
export async function saveStory(client: SupabaseClient, owner: string, post: Post, images: StoryImage[], coverId: string | null, progress?: (text: string) => void): Promise<Post> {
  const fileError = validateImages(images.flatMap((image) => image.file ? [image.file] : []), images.filter((image) => !image.file).length);
  const postError = validatePost(post);
  if (fileError || postError) throw new Error(fileError || postError!);
  if (coverId !== null && !images.some((image) => image.id === coverId)) throw new Error("Choose an existing image as the cover.");
  const storage = client.storage.from("post-images");
  const uploaded: string[] = [];
  let writing = false;
  try {
    const urls: string[] = [];
    for (const [index, image] of images.entries()) {
      if (!image.file) { urls.push(image.url); continue; }
      progress?.(`Uploading image ${index + 1} of ${images.length}…`);
      const path = `${owner}/${crypto.randomUUID()}.${imageTypes[image.file.type]}`;
      const { error } = await storage.upload(path, image.file, { contentType: image.file.type, upsert: false });
      if (error) throw error;
      uploaded.push(path);
      urls.push(storage.getPublicUrl(path).data.publicUrl);
    }
    const next = { ...post, title: post.title.trim(), tags: [...new Set(post.tags.map((tag) => tag.trim()).filter(Boolean))], images: urls, image_url: coverId ? urls[images.findIndex((image) => image.id === coverId)] : "" };
    const validation = validatePost(next);
    if (validation) throw new Error(validation);
    progress?.("Saving story…");
    writing = true;
    const { data, error } = await client.from("posts").upsert(next).select().single();
    if (error) throw error;
    return data as Post;
  } catch (error) {
    // A lost response may follow a committed write. Never break its images by guessing.
    const definiteRejection = typeof error === "object" && error && "code" in error && /^[0-9A-Z]{5}$/.test(String(error.code));
    if (uploaded.length && (!writing || definiteRejection)) {
      try {
        const { error: cleanup } = await storage.remove(uploaded);
        if (cleanup) throw cleanup;
      } catch {
        throw new Error(`${errorMessage(error)} Unused uploads remain in Storage.`);
      }
    }
    throw new Error(`${errorMessage(error)}${writing && !definiteRejection ? " Check your story list before retrying; the save may have completed." : ""}`);
  }
}
