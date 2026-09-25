import assert from "node:assert/strict";
import { selectPosts, safeUrl, validatePost, type Post } from "../lib/posts.ts";
const base: Post = {
  id: "1",
  category: "building",
  title: "A useful project",
  excerpt: "An open source experiment",
  body: "",
  cover: "note",
  image_url: "",
  images: [],
  link_url: "",
  tags: ["Python"],
  date: "2026-09-24",
  pinned: false,
  published: true,
  metadata: {},
};
const items = [
  base,
  { ...base, id: "2", published: false },
  {
    ...base,
    id: "3",
    category: "hackathon" as const,
    pinned: true,
    date: "2024-07-14",
    metadata: { result: "participant" as const },
  },
];
assert.deepEqual(
  selectPosts(items, "all", "").map((p) => p.id),
  ["3", "1"],
);
assert.deepEqual(
  selectPosts(items, "building", "python project").map((p) => p.id),
  ["1"],
);
assert.deepEqual(
  selectPosts(items, "saved", "", ["1", "2"]).map((p) => p.id),
  ["1"],
);
assert.equal(selectPosts(items, "people", "").length, 0);
assert.equal(safeUrl("javascript:alert(1)"), "");
assert.equal(safeUrl("data:text/html,test"), "");
assert.equal(safeUrl("https://github.com/xyd945"), "https://github.com/xyd945");
assert.equal(validatePost(base), null);
assert.ok(validatePost({ ...base, title: " " }));
assert.ok(validatePost({ ...base, link_url: "javascript:alert(1)" }));
assert.ok(validatePost({ ...base, metadata: { lat: 52 } }));
assert.ok(validatePost({ ...base, metadata: { lat: 91, lng: 4 } }));
assert.ok(validatePost({ ...base, metadata: { streak: -1 } }));
assert.ok(validatePost({ ...base, metadata: { xp: 1.5 } }));
assert.equal(
  validatePost({ ...base, metadata: { lat: 0, lng: 0, streak: 0, xp: 0 } }),
  null,
);
assert.ok(validatePost({ ...base, date: "2026-02-31" }));
assert.ok(validatePost({ ...base, category: "constructor" as Post["category"] }));
console.log(
  "Post checks passed: visibility, filters, saved stories, safe links, and metadata validation.",
);
