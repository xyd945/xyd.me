export const categories = {
  building: "Building",
  hackathon: "Hackathons",
  playground: "Playground",
  travel: "Places",
  people: "People",
  life: "Life lately",
  experience: "Experience",
} as const;
export type Category = keyof typeof categories;
export const covers = [
  "studio",
  "film",
  "accounting",
  "ticket",
  "map",
  "spanish",
  "code",
  "plant",
  "people",
  "shell",
  "note",
] as const;
export type Cover = (typeof covers)[number];
export interface Post {
  id: string;
  category: Category;
  title: string;
  excerpt: string;
  body: string;
  cover: Cover;
  image_url: string;
  images: string[];
  link_url: string;
  tags: string[];
  date: string;
  pinned: boolean;
  published: boolean;
  metadata: {
    location?: string;
    lat?: number;
    lng?: number;
    result?: "winner" | "finalist" | "participant";
    award?: string;
    streak?: number;
    xp?: number;
    section?: string;
  };
}
export function safeUrl(value: string): string {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
export function selectPosts(
  posts: Post[],
  category: string,
  query: string,
  saved?: string[],
) {
  const words = query.toLowerCase().trim().split(/\s+/);
  return posts
    .filter(
      (post) =>
        post.published &&
        (category === "all" ||
          (category === "saved"
            ? saved?.includes(post.id)
            : post.category === category)) &&
        words.every((word) =>
          `${post.title} ${post.excerpt} ${post.tags.join(" ")} ${post.metadata.location ?? ""}`
            .toLowerCase()
            .includes(word),
        ),
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) || b.date.localeCompare(a.date),
    );
}
export function validatePost(post: Post): string | null {
  if (!post.title.trim() || post.title.length > 160)
    return "Add a title of 1–160 characters.";
  if (!Object.hasOwn(categories, post.category) || !covers.includes(post.cover))
    return "Choose a valid category and cover.";
  if (post.excerpt.length > 500)
    return "Keep the short description under 500 characters.";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(post.date) ||
    Number.isNaN(Date.parse(post.date)) ||
    new Date(post.date).toISOString().slice(0, 10) !== post.date
  )
    return "Choose a valid date.";
  if (post.link_url && !safeUrl(post.link_url))
    return "The link must begin with https:// or http://.";
  if (!Array.isArray(post.images) || post.images.length > 10 || post.images.some((url) => typeof url !== "string" || !safeUrl(url)))
    return "Choose up to 10 images with valid HTTP URLs.";
  if (post.image_url && !safeUrl(post.image_url))
    return "The image URL must begin with https:// or http://.";
  if (
    post.metadata.result &&
    !["winner", "finalist", "participant"].includes(post.metadata.result)
  )
    return "Choose a valid hackathon result.";
  if ([post.metadata.location, post.metadata.award, post.metadata.section].some((value) => value != null && typeof value !== "string"))
    return "Location, award and learning section must be text.";
  const { lat, lng, streak, xp } = post.metadata;
  if ((lat == null) !== (lng == null))
    return "Add both latitude and longitude.";
  if (lat != null && (!Number.isFinite(lat) || lat < -90 || lat > 90))
    return "Latitude must be between -90 and 90.";
  if (lng != null && (!Number.isFinite(lng) || lng < -180 || lng > 180))
    return "Longitude must be between -180 and 180.";
  if (
    [streak, xp].some((n) => n != null && (!Number.isSafeInteger(n) || n < 0))
  )
    return "Streak and XP must be non-negative whole numbers.";
  return null;
}
export const profile = {
  name: "Yudi Xu",
  github: "https://github.com/xyd945",
  linkedin: "https://www.linkedin.com/in/xuyudi/",
  studio: "https://100things.nl",
};

// Cover first, with compatibility for stories saved before galleries existed.
export function postImages(post: Post): string[] {
  return [...new Set([post.image_url, ...(post.images ?? [])].filter((url) => safeUrl(url)))];
}
