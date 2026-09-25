"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { starterPosts } from "@/data/posts";
import {
  categories,
  profile,
  postImages,
  safeUrl,
  selectPosts,
  type Post,
} from "@/lib/posts";
import { supabase } from "@/lib/supabase";
import Cover from "./Cover";
import Icon from "./Icon";
import PostGallery from "./PostGallery";

type View = "explore" | "about" | "map" | "saved";
const primaryCategories = Object.entries(categories).filter(
  ([key]) => key !== "experience",
);

export default function Journal() {
  const [posts, setPosts] = useState<Post[]>(supabase ? [] : starterPosts);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("explore");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selected, setSelected] = useState<Post | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDialogElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem("xyd-saved") ?? "[]");
      if (Array.isArray(data)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Browser preferences are read after hydration to match the static HTML.
        setSaved(data.filter((id) => typeof id === "string"));
      }
    } catch {
      /* Browsing still works when local storage is unavailable. */
    }
    if (!supabase) return;
    const controller = new AbortController();
    let pending = false;
    async function refresh() {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      const { data, error } = await supabase!.from("posts").select("*").eq("published", true).order("date", { ascending: false }).abortSignal(controller.signal);
      pending = false;
      if (controller.signal.aborted) return;
      if (error) setError("The notebook couldn’t refresh. Please try again in a moment.");
      else { setPosts((data ?? []) as Post[]); setError(""); }
      setLoading(false);
    }
    void refresh();
    // ponytail: one small feed query; add pagination when the notebook outgrows 1,000 stories.
    const interval = setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); clearInterval(interval); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);

  useEffect(() => {
    function readLink() {
      const id = new URLSearchParams(window.location.search).get("post");
      setSelected(posts.find((p) => p.id === id) ?? null);
    }
    readLink();
    window.addEventListener("popstate", readLink);
    return () => window.removeEventListener("popstate", readLink);
  }, [posts]);

  useEffect(() => {
    if (selected) {
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
    }
  }, [selected]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(timeout);
  }, [toast]);

  function openPost(post: Post) {
    setSelected(post);
    const url = new URL(window.location.href);
    url.searchParams.set("post", post.id);
    window.history.pushState(null, "", url);
  }
  function closePost() {
    setSelected(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("post");
    window.history.replaceState(null, "", url);
  }
  function changeView(next: View) {
    menu.current?.close();
    setView(next);
    setCategory("all");
    setQuery("");
    setSearchOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function toggleSaved(id: string) {
    const next = saved.includes(id)
      ? saved.filter((item) => item !== id)
      : [...saved, id];
    setSaved(next);
    try {
      localStorage.setItem("xyd-saved", JSON.stringify(next));
    } catch {
      setToast("Saved for this visit. Browser storage is unavailable.");
    }
  }
  async function share(post: Post) {
    try {
      const url = new URL(window.location.origin);
      url.searchParams.set("post", post.id);
      await navigator.clipboard.writeText(url.href);
      setToast("Link copied. Pass the curiosity on.");
    } catch {
      setToast("Copy this page’s address to share the story.");
    }
  }
  const visible = selectPosts(
    posts,
    view === "saved" ? "saved" : view === "about" ? "experience" : category,
    query,
    saved,
  );
  const places = posts.filter(
    (post) =>
      post.published && post.metadata.lat != null && post.metadata.lng != null,
  );

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <dialog ref={menu} className="nav-drawer" aria-label="Site menu" onClose={() => setMenuOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) menu.current?.close(); }}>
      <aside className="sidebar">
        <button className="icon-button drawer-close" aria-label="Close menu" onClick={() => menu.current?.close()}><Icon name="close"/></button>
        <Link href="/" className="wordmark" aria-label="Yudi Xu home" onNavigate={() => changeView("explore")}>
          <span className="brand-mark" aria-hidden="true">x</span>xyd<span>.me</span>
        </Link>
      <div className="side-intro">A life, in little chapters.</div>
        <nav className="main-nav" aria-label="Main navigation">
          {(
            [
              ["explore", "grid", "Explore"],
              ["about", "person", "About me"],
              ["map", "globe", "The map"],
              ["saved", "bookmark", "Saved"],
            ] as const
          ).map(([key, icon, label]) => (
            <button
              key={key}
              className={view === key ? "nav-item active" : "nav-item"}
              aria-current={view === key ? "page" : undefined}
              onClick={() => changeView(key)}
            >
              <Icon name={icon} />
              <span>{label}</span>
              {key === "explore" && <span className="nav-dot" />}
            </button>
          ))}
        <Link href="/terminal" className="nav-item"><Icon name="terminal"/><span>Terminal</span></Link>
        </nav>
        <div className="elsewhere">
          <span className="eyebrow">ELSEWHERE</span>
          <a
            className="nav-item"
            href={profile.github}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="github" />
            <span>GitHub</span>
            <Icon name="arrow" size={14} />
          </a>
          <a
            className="nav-item"
            href={profile.linkedin}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="linkedin" />
            <span>LinkedIn</span>
            <Icon name="arrow" size={14} />
          </a>
          <a
            className="nav-item"
            href={profile.studio}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="spark" />
            <span>100things</span>
            <Icon name="arrow" size={14} />
          </a>
        </div>
        <div className="sidebar-bottom">
          <span className="brand-mark" aria-hidden="true">x</span>
          <p>
            Stay curious.
            <br />
            Make good things.
          </p>
          <Link href="/admin" className="studio-link">
            Owner’s studio <Icon name="arrow" size={12} />
          </Link>
          <span className="copyright">
            © {new Date().getFullYear()} Yudi Xu
          </span>
        </div>
      </aside>
      </dialog>
      <main id="main" className="main-content">
        <header className="topbar">
          <div className="topbar-brand"><button className="icon-button" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => { menu.current?.showModal(); setMenuOpen(true); }}><Icon name="menu"/></button><Link href="/" className="wordmark" aria-label="Yudi Xu home" onNavigate={() => changeView("explore")}>xyd<span>.me</span></Link></div>
          <span className="topbar-caption">
            THE PERSONAL SIDE OF <strong>YUDI XU</strong>
          </span>
          <a href={profile.linkedin} target="_blank" rel="noreferrer">
            Say hello <Icon name="arrow" size={14} />
          </a>
        </header>
        {view === "explore" && (
          <section className="hero">
            <div className="hero-copy">
              <div className="intro-label">
                <span className="live-dot" /> BUILDER. EXPLORER. WORK IN
                PROGRESS.
              </div>
              <h1>
                A little curious.
                <br />
                Always <span className="serif-word">building.</span>
                <span className="brand-mark hero-brand" aria-hidden="true">x</span>
              </h1>
              <p>
                I’m Yudi. I make things, go places, and meet good people.
                <br className="desktop-break" /> This is my little corner of the
                internet. Come have a look.
              </p>
              <div className="hero-links">
                <button onClick={() => changeView("about")}>
                  A bit about me <Icon name="right" size={16} />
                </button>
                <span>Usually with a sparkling water in hand.</span>
              </div>
            </div>
            <div className="polaroid">
              <span className="tape" />
              <Image
                src="/images/avatar.png"
                alt="Yudi wearing a hoodie that reads Innovation is Freedom"
                width={218}
                height={218}
                priority
              />
              <span className="polaroid-caption">a work in progress :)</span>
              <span className="photo-scribble">that’s not me ↖</span>
            </div>
          </section>
        )}
        {view === "about" && (
          <section className="about-panel">
            <button className="text-button about-back" onClick={() => changeView("explore")}><Icon name="left" size={16}/> Back to Explore</button>
            <span className="eyebrow">HELLO, I’M YUDI.</span>
            <h1>
              Many chapters.
              <br />
              <span className="serif-word">Still curious.</span>
            </h1>
            <p>
              I’m an entrepreneur, a tinkerer, and a lifelong beginner. I’ve
              worked on emerging technology at Shell, built startups, joined
              accelerators, and learned from things that didn’t work.
            </p>
            <p>
              These days, I build through{" "}
              <a href={profile.studio} target="_blank" rel="noreferrer">
                100things
              </a>
              , experiment on GitHub, turn up at hackathons, and learn Spanish
              one lesson at a time.
            </p>
            <div className="about-values">
              <span>Energy & technology</span>
              <span>Building with founders</span>
              <span>Sparkling water at the bar</span>
            </div>
          </section>
        )}
        {view === "map" && (
          <section className="map-section">
            <span className="eyebrow">THE WORLD, A LITTLE CLOSER.</span>
            <h1>
              Places leave <span className="serif-word">a mark.</span>
            </h1>
            <p>
              A few pins from my work and hackathon chapters. More stories to
              come.
            </p>
            <TravelMap places={places} onOpen={openPost} />
          </section>
        )}
        {view === "saved" && (
          <section className="saved-heading">
            <span className="eyebrow">FOR ANOTHER LOOK.</span>
            <h1>
              A little <span className="serif-word">collection.</span>
            </h1>
            <p>Your saved stories, kept in this browser.</p>
          </section>
        )}
        {view !== "map" && (
          <>
            <section className="feed-toolbar" aria-label="Filter stories">
              <div className="feed-heading">
                <h2>
                  {view === "about"
                    ? "An earlier chapter"
                    : view === "saved"
                      ? "Your saved stories"
                      : "A bit of everything"}
                  <span>{visible.length.toString().padStart(2, "0")}</span>
                </h2>
                <button
                  className="search-toggle icon-button"
                  aria-label={searchOpen ? "Close search" : "Search stories"}
                  onClick={() => {
                    setSearchOpen(!searchOpen);
                    if (searchOpen) setQuery("");
                    else setTimeout(() => search.current?.focus(), 0);
                  }}
                >
                  <Icon name={searchOpen ? "close" : "search"} />
                </button>
              </div>
              {searchOpen && (
                <div className="search-field">
                  <Icon name="search" />
                  <input
                    ref={search}
                    aria-label="Search stories"
                    placeholder="Search projects, places, little ideas…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              )}
              {view === "explore" && (
                <div className="filter-row">
                  <button
                    className={category === "all" ? "filter active" : "filter"}
                    onClick={() => setCategory("all")}
                    aria-pressed={category === "all"}
                  >
                    All notes
                  </button>
                  {primaryCategories.map(([key, label]) => (
                    <button
                      key={key}
                      className={category === key ? "filter active" : "filter"}
                      onClick={() => setCategory(key)}
                      aria-pressed={category === key}
                    >
                      {label}
                    </button>
                  ))}
                  <span className="feed-order">
                    A CURATED LITTLE MIX <span>↓</span>
                  </span>
                </div>
              )}
            </section>
            {error && (
              <p role="alert" className="notice error">
                {error}
              </p>
            )}
            {loading ? (
              <div className="empty-state" role="status">
                Opening the notebook…
              </div>
            ) : visible.length ? (
              <div className="post-grid">
                {visible.map((post) => (
                  <article className="post-card" key={post.id}>
                    <button
                      className="card-open"
                      onClick={() => openPost(post)}
                      aria-label={`Read ${post.title}`}
                    >
                      <div className="cover-wrap">
                        <Cover post={post} />
                        {postImages(post).length > 1 && <span className="image-count"><Icon name="image" size={12}/>{postImages(post).length}</span>}
                        {post.pinned && (
                          <span className="pinned-badge">
                            <Icon name="pin" size={12} /> PINNED
                          </span>
                        )}
                      </div>
                      <div className="card-copy">
                        <div
                          className={`category-label category-${post.category}`}
                        >
                          <span />
                          {categories[post.category]}
                          {post.metadata.result && (
                            <span className="result-label">
                              {post.metadata.result === "winner"
                                ? "↗ Winner"
                                : post.metadata.result === "finalist"
                                  ? "Finalist"
                                  : "Participated"}
                            </span>
                          )}
                        </div>
                        <h3>{post.title}</h3>
                        <p>{post.excerpt || post.body.slice(0, 160)}</p>
                      </div>
                    </button>
                    <div className="card-footer">
                      <span>{post.tags.slice(0, 2).join(" · ")}</span>
                      <button
                        className={`bookmark-button ${saved.includes(post.id) ? "is-saved" : ""}`}
                        onClick={() => toggleSaved(post.id)}
                        aria-label={`${saved.includes(post.id) ? "Unsave" : "Save"} ${post.title}`}
                        aria-pressed={saved.includes(post.id)}
                      >
                        <Icon name="bookmark" size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              !error && (
                <div className="empty-state">
                  <Icon
                    name={category === "people" ? "person" : "spark"}
                    size={32}
                  />
                  <h3>
                    {category === "people"
                      ? "Good people. Stories to come."
                      : view === "saved"
                        ? "Keep a little curiosity for later."
                        : "Nothing here just yet."}
                  </h3>
                  <p>
                    {category === "people"
                      ? "A space for the founders I meet, the things they’re building, and what I learn from them."
                      : view === "saved"
                        ? "Tap the bookmark on any story to find it here."
                        : "Try another category or a different search."}
                  </p>
                  <button
                    className="text-button"
                    onClick={() => changeView("explore")}
                  >
                    Explore all notes <Icon name="right" size={16} />
                  </button>
                </div>
              )
            )}
          </>
        )}
        <footer className="page-footer">
          <span className="brand-mark" aria-hidden="true">x</span>
          <p>Not a finished story. Just the latest chapter.</p>
        <span>MADE WITH CURIOSITY, BY YUDI.</span>
        <Link href="/admin" className="studio-link">Owner’s studio <Icon name="arrow" size={12}/></Link>
        </footer>
      </main>
      <dialog
        ref={dialog}
        className="post-dialog"
        onCancel={closePost}
        onClose={() => {
          if (selected) closePost();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) closePost();
        }}
        aria-labelledby="post-title"
      >
        {selected && (
          <div className="dialog-content">
            <button
              className="dialog-close icon-button"
              onClick={closePost}
              aria-label="Close story"
            >
              <Icon name="close" />
            </button>
            <PostGallery key={selected.id} post={selected} />
            <div className="dialog-body">
              <span className="eyebrow">
                {categories[selected.category]} ·{" "}
                {new Date(`${selected.date}T12:00:00`).toLocaleDateString(
                  "en-GB",
                  { year: "numeric", month: "short", day: "numeric" },
                )}
              </span>
              <h2 id="post-title">{selected.title}</h2>
              <p className="dialog-excerpt">{selected.excerpt}</p>
              {selected.metadata.award && (
                <div className="award-note">
                  <Icon name="spark" />
                  {selected.metadata.award}
                </div>
              )}
              {selected.body.split("\n\n").map((paragraph, i) => (
                <p key={i} className="story-paragraph">
                  {paragraph}
                </p>
              ))}
              {selected.category === "life" &&
                (selected.metadata.streak != null ||
                  selected.metadata.xp != null ||
                  selected.metadata.section) && (
                  <div className="progress-stats">
                    {selected.metadata.streak != null && (
                      <div>
                        <strong>{selected.metadata.streak}</strong>
                        <span>day streak</span>
                      </div>
                    )}
                    {selected.metadata.xp != null && (
                      <div>
                        <strong>{selected.metadata.xp.toLocaleString()}</strong>
                        <span>total XP</span>
                      </div>
                    )}
                    {selected.metadata.section && (
                      <div>
                        <strong>{selected.metadata.section}</strong>
                        <span>current section</span>
                      </div>
                    )}
                  </div>
                )}
              {selected.metadata.location && (
                <p className="story-location">
                  <Icon name="location" size={16} />
                  {selected.metadata.location}
                </p>
              )}
              <div className="story-tags">
                {selected.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <div className="dialog-actions">
                {safeUrl(selected.link_url) && (
                  <a
                    className="primary-button"
                    href={safeUrl(selected.link_url)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {selected.link_url.includes("github.com")
                      ? "Explore the repository"
                      : "Visit website"}
                    <Icon name="arrow" size={17} />
                  </a>
                )}
                <button
                  className="secondary-button"
                  onClick={() => toggleSaved(selected.id)}
                >
                  <Icon
                    name={saved.includes(selected.id) ? "check" : "bookmark"}
                    size={17}
                  />
                  {saved.includes(selected.id) ? "Saved" : "Save story"}
                </button>
                <button
                  className="icon-button"
                  onClick={() => share(selected)}
                  aria-label="Copy story link"
                >
                  <Icon name="share" />
                </button>
              </div>
            </div>
          </div>
        )}
      </dialog>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function TravelMap({
  places,
  onOpen,
}: {
  places: Post[];
  onOpen: (post: Post) => void;
}) {
  const [region, setRegion] = useState<"world" | "europe">("europe");
  const bounds =
    region === "world"
      ? { x: 0, y: 0, w: 720, h: 360 }
      : { x: 330, y: 52, w: 110, h: 64 };
  return (
    <>
      <div className="travel-map">
        <div className="map-controls">
          <button
            className={region === "europe" ? "active" : ""}
            onClick={() => setRegion("europe")}
            aria-pressed={region === "europe"}
          >
            Europe
          </button>
          <button
            className={region === "world" ? "active" : ""}
            onClick={() => setRegion("world")}
            aria-pressed={region === "world"}
          >
            The world
          </button>
        </div>
        <svg
          viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
          role="group"
          aria-label="Map of places in Yudi’s stories"
        >
          <image href="/images/world.svg" width="720" height="360" />
          {places.map((place) => (
            <a
              key={place.id}
              href={`?post=${place.id}`}
              aria-label={`Read about ${place.metadata.location}`}
              onClick={(event) => { event.preventDefault(); onOpen(place); }}
            >
              <title>{place.metadata.location}</title>
              <circle
                cx={(place.metadata.lng! + 180) * 2}
                cy={(90 - place.metadata.lat!) * 2}
                r={region === "world" ? 8 : 2.5}
                fill="transparent"
              />
              <circle
                cx={(place.metadata.lng! + 180) * 2}
                cy={(90 - place.metadata.lat!) * 2}
                r={region === "world" ? 3 : 0.85}
                fill="#ef633f"
                stroke="#fff"
                strokeWidth={region === "world" ? 1 : 0.3}
              />
            </a>
          ))}
        </svg>
        <span className="map-legend">
          <span className="live-dot" />
          {places.length} chapters on the map
        </span>
      </div>
      <div className="place-list">
        {places.map((place) => (
          <button key={place.id} onClick={() => onOpen(place)}>
            <Icon name="location" />
            <span>
              <strong>{place.metadata.location}</strong>
              <small>{place.title}</small>
            </span>
            <Icon name="arrow" size={17} />
          </button>
        ))}
      </div>
      {places.length === 0 && (
        <p className="empty-state">The first pin is still to come.</p>
      )}
    </>
  );
}
