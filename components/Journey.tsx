"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { GeoJSONSource, LayerSpecification, Map as MapLibreMap } from "maplibre-gl";
import { categories, profile, type Post } from "@/lib/posts";
import { flyDuration, journeyStops, monthYear, routeLine, storiesAt, type Stop } from "@/lib/journey";
import Cover from "./Cover";

// Free vector tiles, no key. Attribution stays on the map, as its licence asks.
const STYLE = "https://tiles.openfreemap.org/styles/positron";
const DEM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const HIDE = new Set(["transportation", "transportation_name", "building", "poi", "housenumber", "aerodrome_label", "aeroway", "landuse", "landcover", "park", "water_name", "place", "mountain_peak"]);
const STOP_ZOOM = 5.2;

function lineFeature(coordinates: [number, number][]): GeoJSON.Feature<GeoJSON.LineString> {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } };
}
function pad() {
  return matchMedia("(max-width: 700px)").matches ? { top: 60, bottom: 230, left: 0, right: 0 } : { top: 40, bottom: 80, left: 0, right: 420 };
}

export default function Journey({ posts, onOpen, onPlace, loading = false, mode = "journey" }: {
  posts: Post[];
  loading?: boolean;
  onOpen: (post: Post) => void;
  onPlace?: (place: string) => void;
  mode?: "journey" | "free";
}) {
  // The feed refetches every 30 seconds with new objects; only a real change may rebuild the map.
  const signature = JSON.stringify(journeyStops(posts));
  const stops = useMemo(() => JSON.parse(signature) as Stop[], [signature]);
  const section = useRef<HTMLElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const pins = useRef(new Map<string, HTMLElement>());
  const ready = useRef(false);
  const open = useRef(onOpen);
  const activeRef = useRef(0);
  const previous = useRef<number | null>(null);
  const [active, setActive] = useState(0);
  const [mapFailed, setMapFailed] = useState(false);
  const stop = stops[active] as Stop | undefined;
  const years = useMemo(() => [...new Set(stops.map((s) => s.year))], [stops]);
  const more = stop ? storiesAt(posts, stop.place).length - 1 : 0;

  useEffect(() => { open.current = onOpen; });
  useEffect(() => { activeRef.current = active; });

  function paint(index: number) {
    const m = map.current;
    if (!m || !ready.current) return;
    (m.getSource("past") as GeoJSONSource).setData(lineFeature(routeLine(stops.slice(0, index + 1))));
    (m.getSource("next") as GeoJSONSource).setData(lineFeature(routeLine(stops.slice(index))));
    for (const [place, el] of pins.current) {
      const at = stops.flatMap((s, k) => (s.place === place ? [k] : []));
      el.classList.toggle("is-now", at.includes(index));
      el.classList.toggle("is-next", at.every((k) => k > index));
    }
  }
  /* The panel sticks at its CSS `top`; the rest of the section's height is the scroll distance that drives the stops. */
  function geometry() {
    const el = section.current;
    if (!el) return null;
    const panel = el.firstElementChild as HTMLElement;
    const stickyTop = parseFloat(getComputedStyle(panel).top) || 0;
    return { el, stickyTop, travel: el.offsetHeight - panel.offsetHeight - stickyTop - 16 };
  }
  function goTo(index: number) {
    const g = geometry();
    if (!g) return;
    const top = window.scrollY + g.el.getBoundingClientRect().top - g.stickyTop + ((index + 0.5) / stops.length) * g.travel;
    window.scrollTo({ top, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  useEffect(() => {
    if (!box.current || !stops.length) return;
    let cancelled = false;
    let instance: MapLibreMap | undefined;
    const pinMap = pins.current;
    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !box.current) return;
      maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs"); // see scripts/copy-maplibre-worker.mjs
      const first = stops[activeRef.current] ?? stops[0];
      const m = new maplibregl.Map({
        container: box.current, style: STYLE, attributionControl: false, interactive: mode === "free",
        center: [first.lng, first.lat], zoom: STOP_ZOOM, fadeDuration: 0,
      });
      instance = m;
      map.current = m;
      m.on("load", () => {
        const layers: LayerSpecification[] = m.getStyle().layers;
        for (const layer of layers) {
          const sourceLayer = (layer as { "source-layer"?: string })["source-layer"];
          if (layer.type === "symbol" || (sourceLayer && HIDE.has(sourceLayer))) { m.setLayoutProperty(layer.id, "visibility", "none"); continue; }
          if (layer.type === "background") m.setPaintProperty(layer.id, "background-color", "#ECEBE3");
          if (layer.type === "fill" && sourceLayer === "water") m.setPaintProperty(layer.id, "fill-color", "#D2DBDF");
          if (layer.type === "line" && sourceLayer === "waterway") m.setPaintProperty(layer.id, "line-color", "#C3CFD4");
          if (layer.type === "line" && sourceLayer === "boundary") m.setPaintProperty(layer.id, "line-color", "#B5B4AA");
        }
        const water = layers.find((layer) => (layer as { "source-layer"?: string })["source-layer"] === "water");
        try {
          m.addSource("dem", { type: "raster-dem", tiles: [DEM], encoding: "terrarium", tileSize: 256, maxzoom: 12 });
          m.addLayer({ id: "hill", type: "hillshade", source: "dem", paint: { "hillshade-exaggeration": 0.32, "hillshade-shadow-color": "#8e9388", "hillshade-highlight-color": "#ffffff", "hillshade-accent-color": "#c9cdc1" } }, water?.id);
          m.setProjection({ type: "globe" });
        } catch { /* flat map without relief still works */ }
        m.addSource("next", { type: "geojson", data: lineFeature(routeLine(stops)) });
        m.addLayer({ id: "next", type: "line", source: "next", paint: { "line-color": "#9a9b92", "line-width": 1.4, "line-dasharray": [1.5, 2.2], "line-opacity": 0.8 } });
        m.addSource("past", { type: "geojson", data: lineFeature([]) });
        m.addLayer({ id: "past-glow", type: "line", source: "past", paint: { "line-color": "#eb603f", "line-width": 9, "line-blur": 8, "line-opacity": 0.28 } });
        m.addLayer({ id: "past", type: "line", source: "past", paint: { "line-color": "#eb603f", "line-width": 2.4, "line-dasharray": [2.2, 1.6] } });
        const places = new Map<string, Stop[]>();
        for (const s of stops) places.set(s.place, [...(places.get(s.place) ?? []), s]);
        for (const [place, list] of places) {
          const el = document.createElement("button");
          el.type = "button";
          el.className = "stop-pin";
          el.setAttribute("aria-label", `${place}: ${list.map((s) => s.post.title).join("; ")}`);
          const dot = document.createElement("i"), name = document.createElement("span"), when = document.createElement("small");
          name.textContent = place;
          when.textContent = [...new Set(list.map((s) => s.year))].join(", ");
          el.append(dot, name, when);
          el.addEventListener("click", () => (mode === "free" ? open.current(list[0].post) : goTo(stops.indexOf(list[0]))));
          new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([list[0].lng, list[0].lat]).addTo(m);
          pinMap.set(place, el);
        }
        ready.current = true;
        m.once("idle", () => box.current?.classList.add("is-ready"));
        if (mode === "free") {
          const bounds = new maplibregl.LngLatBounds();
          for (const s of stops) bounds.extend([s.lng, s.lat]);
          m.fitBounds(bounds, { padding: 70, maxZoom: 6, duration: 0 });
          paint(stops.length - 1);
        } else {
          const at = Math.min(activeRef.current, stops.length - 1);
          m.jumpTo({ center: [stops[at].lng, stops[at].lat], zoom: STOP_ZOOM, padding: pad() });
          paint(at);
          previous.current = at; // otherwise the first scroll step jumps instead of flying
        }
      });
    })().catch(() => setMapFailed(true)); // no WebGL, or the map script failed to load
    return () => { cancelled = true; ready.current = false; instance?.remove(); map.current = null; pinMap.clear(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- paint/goTo read the same `stops` this effect closes over.
  }, [stops, mode]);

  // Scroll position inside the tall section picks the stop.
  useEffect(() => {
    if (mode !== "journey" || stops.length < 2) return;
    let frame = 0;
    function read() {
      frame = 0;
      const g = geometry();
      if (!g) return;
      const progress = g.travel > 0 ? Math.min(1, Math.max(0, (g.stickyTop - g.el.getBoundingClientRect().top) / g.travel)) : 0;
      const index = Math.min(stops.length - 1, Math.floor(progress * stops.length));
      setActive((prev) => (prev === index ? prev : index));
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(read); }
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, [mode, stops.length]);

  // The camera follows the active stop.
  useEffect(() => {
    const m = map.current, s = stops[active];
    if (mode !== "journey" || !m || !s || !ready.current) return;
    const from = previous.current == null ? null : stops[previous.current];
    previous.current = active;
    const target = { center: [s.lng, s.lat] as [number, number], zoom: STOP_ZOOM, padding: pad() };
    if (!from || matchMedia("(prefers-reduced-motion: reduce)").matches) m.jumpTo(target);
    else m.flyTo({ ...target, duration: flyDuration(from, s), essential: true });
    paint(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- paint only depends on `stops`, already listed.
  }, [active, stops, mode]);

  if (!stops.length && !loading) return null;
  return (
    <section ref={section} className={`journey ${mode}`} style={{ "--stops": stops.length } as CSSProperties} aria-label={mode === "free" ? "Map of places in the stories" : "A journey through the stories"}>
      <div className="journey-panel">
        <div ref={box} className="journey-map" />
        <span className="journey-loading" aria-hidden={!mapFailed}>{mapFailed ? "The map couldn’t load. The stories below still work." : "Loading the map…"}</span>
        <a className="journey-attr" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap, OpenMapTiles, OpenFreeMap, Mapzen</a>
        {mode === "journey" && (
          <div className="journey-head">
            <h1>Things I build. Places I go. People I meet.</h1>
            <p>{profile.name}, The Hague.{stops.length > 0 && ` Scroll to follow the route, ${stops[0].year} to now.`}</p>
          </div>
        )}
        {mode === "journey" && stop && (
          <>
            {active === 0 && <span className="journey-cue" aria-hidden="true">Scroll ↓</span>}
            <article className="stop-card" key={stop.post.id}>
              <button className="stop-open" onClick={() => onOpen(stop.post)} aria-label={`Read ${stop.post.title}`}>
                <div className="stop-media"><Cover post={stop.post} /></div>
                <div className="stop-row"><span className="stop-year">{stop.year}</span><span className="stop-cat">{categories[stop.post.category]}</span></div>
                <h2>{stop.post.title}</h2>
                <p className="stop-meta">{monthYear(stop.post.date)}, {stop.place}.{stop.post.metadata.award ? ` ${stop.post.metadata.award}.` : stop.post.metadata.result === "winner" ? " Prize winner." : ""}</p>
              </button>
              {more > 0 && onPlace && (
                <button className="stop-more" onClick={() => onPlace(stop.place)}>{more} more {more === 1 ? "story" : "stories"} from {stop.place}</button>
              )}
            </article>
            <div className="scrub" role="group" aria-label="Jump to a year">
              <div className="scrub-track"><span className="scrub-fill" style={{ width: `${(active / Math.max(1, stops.length - 1)) * 100}%` }} /><span className="scrub-knob" style={{ left: `${(active / Math.max(1, stops.length - 1)) * 100}%` }} /></div>
              <div className="scrub-ticks">
                {years.map((year) => (
                  <button key={year} className={year === stop.year ? "active" : ""} aria-pressed={year === stop.year} onClick={() => goTo(stops.findIndex((s) => s.year === year))}>{year}</button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
