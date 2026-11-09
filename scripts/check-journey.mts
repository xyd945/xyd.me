import assert from "node:assert/strict";
import type { Post } from "../lib/posts.ts";
import { flyDuration, greatCircle, journeyStops, monthYear, placeName, routeLine, storiesAt } from "../lib/journey.ts";

const base: Post = {
  id: "1", category: "hackathon", title: "Brussels", excerpt: "", body: "", cover: "ticket", image_url: "", images: [], link_url: "",
  tags: [], date: "2024-07-14", pinned: false, published: true, metadata: { location: "Brussels, Belgium", lat: 50.8503, lng: 4.3517 },
};
const posts: Post[] = [
  base,
  { ...base, id: "2", title: "Essen", date: "2017-06-12", metadata: { location: "Essen, Germany", lat: 51.4508, lng: 7.0131 } },
  { ...base, id: "3", title: "No coordinates", date: "2019-09-01", metadata: { location: "Netherlands" } },
  { ...base, id: "4", title: "Half coordinates", date: "2020-01-01", metadata: { location: "Nowhere", lat: 1 } },
  { ...base, id: "5", title: "Draft", date: "2025-01-01", published: false, metadata: { location: "Zurich, CH", lat: 47.37, lng: 8.54 } },
  { ...base, id: "6", title: "Trading", date: "2026-07-25", metadata: { location: "the hague, The Netherlands" } },
  { ...base, id: "7", title: "Mobility", date: "2019-11-25", metadata: { location: "The Hague, The Netherlands", lat: 52.0967, lng: 4.3288 } },
];

const stops = journeyStops(posts);
assert.deepEqual(stops.map((s) => s.post.id), ["2", "7", "1"], "oldest first, only published stories with both coordinates");
assert.deepEqual(stops.map((s) => s.place), ["Essen", "The Hague", "Brussels"]);
assert.deepEqual(stops.map((s) => s.year), ["2017", "2019", "2024"]);

assert.equal(placeName("The Hague, The Netherlands"), "The Hague");
assert.equal(placeName(undefined), "");
assert.equal(journeyStops([{ ...base, metadata: { lat: 0, lng: 0 } }])[0].place, "Somewhere");

assert.deepEqual(storiesAt(posts, "The Hague").map((p) => p.id), ["6", "7"], "matches the place name case-insensitively, published only");
assert.deepEqual(storiesAt(posts, ""), []);

const arc = greatCircle([4.3517, 50.8503], [121.547, 29.872], 10);
assert.equal(arc.length, 11);
assert.deepEqual(arc[0].map((n) => +n.toFixed(4)), [4.3517, 50.8503]);
assert.deepEqual(arc[10].map((n) => +n.toFixed(3)), [121.547, 29.872]);
assert.ok(arc[5][1] > 50.9, "the arc to Ningbo bows north of a straight line");
assert.deepEqual(greatCircle([1, 1], [1, 1]), [[1, 1], [1, 1]], "a zero-length leg does not divide by zero");

assert.equal(routeLine(stops).length, 2 * 49, "one 48-segment arc per leg");
assert.equal(routeLine(stops.slice(0, 1)).length, 0);

const short = flyDuration(stops[0], stops[1]), long = flyDuration(stops[2], { ...stops[2], lng: 121.547, lat: 29.872 });
assert.ok(short >= 1100 && short < long && long <= 3200, `camera times scale with distance (${short}, ${long})`);

assert.equal(monthYear("2019-11-25"), "November 2019");

console.log("journey checks passed");
