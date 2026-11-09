import type { Post } from "./posts.ts";

export interface Stop {
  post: Post;
  lng: number;
  lat: number;
  year: string;
  place: string;
}

/** "The Hague, The Netherlands" → "The Hague". */
export function placeName(location?: string): string {
  return (location ?? "").split(",")[0].trim();
}

/** Published stories with coordinates, oldest first: the route of the journey. */
export function journeyStops(posts: Post[]): Stop[] {
  return posts
    .filter(
      (post) =>
        post.published &&
        Number.isFinite(post.metadata.lat) &&
        Number.isFinite(post.metadata.lng),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((post) => ({
      post,
      lng: post.metadata.lng!,
      lat: post.metadata.lat!,
      year: post.date.slice(0, 4),
      place: placeName(post.metadata.location) || "Somewhere",
    }));
}

/** Published stories whose location starts with the same place name (case-insensitive). */
export function storiesAt(posts: Post[], place: string): Post[] {
  const key = place.trim().toLowerCase();
  return key
    ? posts.filter(
        (post) =>
          post.published &&
          placeName(post.metadata.location).toLowerCase() === key,
      )
    : [];
}

/** Points along the great circle from a to b ([lng, lat] degrees), inclusive. */
export function greatCircle(
  a: [number, number],
  b: [number, number],
  segments = 48,
): [number, number][] {
  const r = Math.PI / 180;
  const [l1, p1, l2, p2] = [a[0] * r, a[1] * r, b[0] * r, b[1] * r];
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((p2 - p1) / 2) ** 2 +
          Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2,
      ),
    );
  if (d < 1e-9) return [a, b];
  const points: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
    const z = A * Math.sin(p1) + B * Math.sin(p2);
    points.push([
      Math.atan2(y, x) / r,
      Math.atan2(z, Math.sqrt(x * x + y * y)) / r,
    ]);
  }
  return points;
}

/** One line through the given stops, leg by leg along great circles. */
export function routeLine(stops: Stop[]): [number, number][] {
  const line: [number, number][] = [];
  for (let i = 0; i < stops.length - 1; i++)
    line.push(
      ...greatCircle([stops[i].lng, stops[i].lat], [stops[i + 1].lng, stops[i + 1].lat]),
    );
  return line;
}

/** Camera time for a leg: short hops glide, continent jumps take longer. */
export function flyDuration(a: Stop, b: Stop): number {
  const km =
    6371 *
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin(((b.lat - a.lat) * Math.PI) / 360) ** 2 +
          Math.cos((a.lat * Math.PI) / 180) *
            Math.cos((b.lat * Math.PI) / 180) *
            Math.sin(((b.lng - a.lng) * Math.PI) / 360) ** 2,
      ),
    );
  return Math.round(Math.min(3200, 1100 + km / 4));
}

export function monthYear(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
  });
}
