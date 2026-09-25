"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { requestEmailCode, verifyEmailCode } from "@/lib/email-otp";
import { categories, covers, postImages, type Category, type Cover as CoverType, type Post } from "@/lib/posts";
import { errorMessage, imageTypes, saveStory, validateImages, type StoryImage } from "@/lib/story-media";
import { starterPosts } from "@/data/posts";
import Cover from "./Cover";
import Icon from "./Icon";

function blankPost(): Post {
  return { id: crypto.randomUUID(), category: "building", title: "", excerpt: "", body: "", cover: "note", image_url: "", images: [], link_url: "", tags: [], date: new Date().toISOString().slice(0, 10), pinned: false, published: false, metadata: {} };
}
function mediaFor(post: Post): StoryImage[] { return postImages(post).map((url) => ({ id: url, url })); }
function snapshot(post: Post, media: StoryImage[], cover: string | null) { return JSON.stringify([post, media.map((item) => item.id), cover]); }

export default function Studio() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(Boolean(supabase));
  const [allowed, setAllowed] = useState(false);
  const [preview, setPreview] = useState(false);
  const [email, setEmail] = useState("");
  const [codeEmail, setCodeEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [draft, setDraft] = useState<Post | null>(null);
  const [media, setMedia] = useState<StoryImage[]>([]);
  const [coverId, setCoverId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [dragging, setDragging] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [baseline, setBaseline] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const objectUrls = useRef(new Set<string>());
  const loaded = useRef(false);
  const unsaved = Boolean(draft && snapshot(draft, media, coverId) !== baseline);

  useEffect(() => { const urls = objectUrls.current; return () => urls.forEach(URL.revokeObjectURL); }, []);
  useEffect(() => {
    if (deleteTarget) deleteDialog.current?.showModal();
    else deleteDialog.current?.close();
  }, [deleteTarget]);
  useEffect(() => {
    if (!unsaved) return;
    function warn(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = ""; }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);
  function canLeave() { return !unsaved || window.confirm("Discard the changes you haven’t saved?"); }
  function feedback(text: string, error = false) { setMessage(text); setIsError(error); }
  function resetEditor(post: Post | null) {
    objectUrls.current.forEach(URL.revokeObjectURL);
    objectUrls.current.clear();
    const images = post ? mediaFor(post) : [];
    const cover = post?.image_url || null;
    setDraft(post ? structuredClone(post) : null);
    setMedia(images); setCoverId(cover);
    setBaseline(post ? snapshot(post, images, cover) : "");
  }
  function edit(post: Post | null) { if (canLeave()) { resetEditor(post); feedback(""); } }

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (next || event === "SIGNED_OUT") { setCodeEmail(""); setCode(""); }
      if (event === "SIGNED_OUT") feedback("");
      if (!next) { setChecking(false); setAllowed(false); setPosts([]); setDeleteTarget(null); resetEditor(null); loaded.current = false; }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!supabase || !session) return;
    let active = true;
    async function check() {
      if (!loaded.current) setChecking(true);
      try {
        const { data: isAdmin, error: roleError } = await supabase!.rpc("is_site_admin");
        if (roleError) throw roleError;
        if (!isAdmin) throw new Error("This account is signed in, but it is not a site administrator.");
        const { data, error } = await supabase!.from("posts").select("*").order("date", { ascending: false });
        if (error) throw error;
        if (!active) return;
        setAllowed(true); setPosts(data as Post[]);
        if (!loaded.current) {
          const id = new URLSearchParams(window.location.search).get("edit");
          const post = (data as Post[]).find((post) => post.id === id);
          if (post) resetEditor(post);
        }
        loaded.current = true;
      } catch (error) { if (active) feedback(errorMessage(error), true); }
      finally { if (active) setChecking(false); }
    }
    void check();
    return () => { active = false; };
  }, [session]);

  function update<K extends keyof Post>(key: K, value: Post[K]) { setDraft((prev) => prev ? { ...prev, [key]: value } : prev); }
  function meta<K extends keyof Post["metadata"]>(key: K, value: Post["metadata"][K]) { setDraft((prev) => prev ? { ...prev, metadata: { ...prev.metadata, [key]: value } } : prev); }
  function addImages(files: File[]) {
    if (busy || !files.length) return;
    const error = validateImages(files, media.length);
    if (error) return feedback(error, true);
    const additions = files.map((file) => {
      const url = URL.createObjectURL(file); objectUrls.current.add(url);
      return { id: crypto.randomUUID(), url, file };
    });
    setMedia([...media, ...additions]);
    if (!media.length && !coverId) setCoverId(additions[0].id);
    feedback("");
  }
  function removeImage(id: string) {
    const next = media.filter((image) => image.id !== id);
    const removed = media.find((image) => image.id === id);
    if (removed?.file) { URL.revokeObjectURL(removed.url); objectUrls.current.delete(removed.url); }
    setMedia(next);
    if (id === coverId) setCoverId(next[0]?.id ?? null);
  }
  async function sendCode() {
    if (!supabase || busy) return;
    setBusy(true); feedback("");
    try {
      const address = await requestEmailCode(supabase, codeEmail || email);
      setCodeEmail(address); setCode("");
      feedback("Code sent. Check your inbox and spam folder.");
    } catch (error) { feedback(errorMessage(error), true); }
    finally { setBusy(false); }
  }
  async function login(event: React.FormEvent) {
    event.preventDefault(); if (!supabase || !codeEmail || busy) return;
    setBusy(true); feedback("");
    try {
      await verifyEmailCode(supabase, codeEmail, code);
    } catch (error) { feedback(errorMessage(error), true); }
    finally { setBusy(false); }
  }
  async function logout() {
    if (!supabase || !canLeave()) return;
    const { error } = await supabase.auth.signOut();
    if (error) feedback(error.message, true);
  }
  async function save(published: boolean) {
    if (!draft || !supabase || !allowed || !session || busy) return;
    setBusy(true); feedback("");
    try {
      const saved = await saveStory(supabase, session.user.id, { ...draft, published }, media, coverId, feedback);
      setPosts((prev) => [saved, ...prev.filter((post) => post.id !== saved.id)].sort((a, b) => b.date.localeCompare(a.date)));
      resetEditor(saved);
      feedback(saved.published ? "Published. Your live notebook will pick up the update." : "Draft saved. Ready whenever you are.");
    } catch (error) { feedback(errorMessage(error), true); }
    finally { setBusy(false); }
  }
  async function setVisibility(post: Post, published: boolean) {
    if (!supabase || !allowed || !session || busy) return;
    setBusy(true); feedback("");
    try {
      const { data, error } = await supabase.from("posts").update({ published }).eq("id", post.id).select().single();
      if (error) throw error;
      setPosts((prev) => prev.map((item) => item.id === post.id ? data as Post : item));
      if (draft?.id === post.id) {
        update("published", published);
        // Change visibility without saving or discarding the editor's other changes.
        setBaseline((previous) => { const state = JSON.parse(previous); state[0].published = published; return JSON.stringify(state); });
      }
      feedback(published ? "Story is visible on your notebook." : "Story hidden. It’s kept in Drafts and can be shown again.");
    } catch (error) { feedback(errorMessage(error), true); }
    finally { setBusy(false); }
  }
  function askToDelete(post: Post) {
    if (!allowed || !session || busy) return;
    setDeleteError(""); setDeleteTarget(post); feedback("");
  }
  async function remove() {
    if (!deleteTarget || !supabase || !allowed || !session || busy) return;
    setBusy(true); setDeleteError("");
    try {
      const { error } = await supabase.from("posts").delete().eq("id", deleteTarget.id).select("id").single();
      if (error) throw error;
      setPosts((prev) => prev.filter((post) => post.id !== deleteTarget.id));
      if (draft?.id === deleteTarget.id) resetEditor(null);
      setDeleteTarget(null); feedback("Story permanently deleted.");
    } catch (error) { setDeleteError(errorMessage(error)); }
    finally { setBusy(false); }
  }
  async function importPosts() {
    if (!supabase || !allowed) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("posts").upsert(starterPosts, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
      const { data, error: readError } = await supabase.from("posts").select("*").order("date", { ascending: false });
      if (readError) throw readError;
      setPosts(data as Post[]); feedback("Starter stories imported. Existing edits were kept.");
    } catch (error) { feedback(errorMessage(error), true); }
    finally { setBusy(false); }
  }
  const chosen = media.find((image) => image.id === coverId);
  const savedPost = posts.find((post) => post.id === draft?.id);
  const library = posts.filter((post) => filter === "all" || post.published === (filter === "published"));
  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <Link href="/" className="wordmark" onClick={(event) => { if (!canLeave()) event.preventDefault(); }}><span className="brand-mark" aria-hidden="true">x</span>xyd<span>.me</span></Link>
        <div><Link href="/" onClick={(event) => { if (!canLeave()) event.preventDefault(); }}>View notebook ↗</Link>{session && <button className="secondary-button" onClick={logout} disabled={busy}>Sign out</button>}</div>
      </header>
      {checking ? <div className="empty-state" role="status">Opening your studio…</div> : !allowed && !preview ? (
        <section className="login-panel">
          <span className="eyebrow">A LITTLE SPACE TO MAKE SOMETHING.</span><h1>Your stories.</h1><p>A photo, a thought, a new chapter.</p>
          {!supabase ? <><p className="notice">Connect Supabase to save and publish your stories.</p><button className="primary-button" onClick={() => { setPreview(true); setPosts(starterPosts); }}>Try the studio <Icon name="right" size={16}/></button></> : session ? <p>Owner access is required. Check your account’s site admin membership.</p> : (
            codeEmail ? <form key="code" onSubmit={login}>
              <p className="login-instructions" id="code-instructions">Enter the six-digit code sent to <strong>{codeEmail}</strong>.</p>
              <label className="field">Email code<input className="otp-input" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required autoFocus aria-describedby="code-instructions" value={code} disabled={busy} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000"/></label>
              <button className="primary-button" disabled={busy || code.length !== 6}>{busy ? "Please wait…" : "Sign in"}</button>
              <div className="login-actions"><button className="text-button" type="button" disabled={busy} onClick={() => void sendCode()}>Resend code</button><button className="text-button" type="button" disabled={busy} onClick={() => { setCodeEmail(""); setCode(""); feedback(""); }}>Change email</button></div>
            </form> : <form key="email" onSubmit={(event) => { event.preventDefault(); void sendCode(); }}>
              <label className="field">Your email<input type="email" required autoComplete="email" value={email} disabled={busy} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com"/></label>
              <button className="primary-button" disabled={busy}>{busy ? "Sending…" : "Email me a code"}</button>
            </form>
          )}
        </section>
      ) : <>
        {preview && <p className="notice preview-notice">Preview mode · Try photos and edits here. Connect Supabase to save them.</p>}
        {!draft ? <>
          <section className="admin-intro"><div><span className="eyebrow">YOUR LITTLE CORNER OF THE INTERNET</span><h1>Your stories.</h1><p>Small updates. Good memories. Things worth sharing.</p></div><button className="primary-button" onClick={() => edit(blankPost())} disabled={busy}><Icon name="plus" size={17}/> New story</button></section>
          <div className="library-toolbar"><div className="library-tabs">{["all", "drafts", "published"].map((value) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === "all" ? "All stories" : value === "drafts" ? "Drafts" : "Published"}<span>{posts.filter((post) => value === "all" || post.published === (value === "published")).length}</span></button>)}</div>{!preview && <button className="text-button" disabled={busy} onClick={importPosts}>Import starter stories</button>}</div>
          <div className="story-library">{library.map((post) => <article className="library-card" key={post.id} aria-label={post.title}>
            <button className="library-card-open" onClick={() => edit(post)} disabled={busy} aria-label={`Edit story: ${post.title}`}><Cover post={post}/><div className="library-card-copy"><span className="eyebrow">{categories[post.category]} · {post.published ? "Published" : "Private draft"}</span><h2>{post.title}</h2><span>{post.date} <Icon name="arrow" size={14}/></span></div></button>
            {!preview && <div className="library-card-actions"><button className="text-button" disabled={busy} onClick={() => void setVisibility(post, !post.published)} aria-label={`${post.published ? "Hide" : "Show"} story: ${post.title}`}>{post.published ? "Hide story" : "Show story"}</button><button className="text-button delete-button" disabled={busy} onClick={() => askToDelete(post)} aria-label={`Delete story: ${post.title}`}>Delete story</button></div>}
          </article>)}</div>
          {!library.length && <div className="empty-state"><Icon name="image" size={36}/><h3>A little story starts here.</h3><p>Add a photo, or just write what’s on your mind.</p></div>}
        </> : <>
          <div className="composer-heading"><button className="text-button" disabled={busy} onClick={() => edit(null)}><Icon name="left" size={17}/> Your stories</button><span>{draft.published ? "Published story" : "Private draft · Hidden from notebook"}</span>
            {savedPost && !preview && <div className="story-management">{savedPost.published && <button className="secondary-button" disabled={busy} onClick={() => void setVisibility(savedPost, false)}>Hide story</button>}<button className="secondary-button delete-button" disabled={busy} onClick={() => askToDelete(savedPost)}>Delete story</button></div>}
          </div>
          <form className="composer" onSubmit={(event) => { event.preventDefault(); void save(true); }}>
            <fieldset disabled={busy}>
              <div className="composer-grid">
                <section className="composer-media" aria-label="Story images">
                  <div className={`photo-drop ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); addImages(Array.from(event.dataTransfer.files)); }}>
                    {media.length || draft.title ? <div className="composer-cover">{chosen ? <Image unoptimized src={chosen.url} alt="Selected story cover" fill sizes="500px"/> : <Cover post={{ ...draft, image_url: "" }}/>}</div> : <div className="upload-empty"><span><Icon name="image" size={34}/></span><h2>Start with a moment.</h2><p>Drop your photos here,<br/>or pick a few from your device.</p></div>}
                    <button type="button" className={media.length ? "secondary-button" : "primary-button"} onClick={() => fileInput.current?.click()} disabled={media.length >= 10}><Icon name="plus" size={16}/>{media.length ? "Add photos" : "Choose photos"}</button>
                    <span className="field-hint">{media.length}/10 photos · Up to 8 MB each · Drag & drop</span>
                    <input ref={fileInput} className="visually-hidden" aria-label="Upload story images" tabIndex={-1} type="file" multiple accept={Object.keys(imageTypes).join(",")} onChange={(event) => { addImages(Array.from(event.target.files ?? [])); event.target.value = ""; }}/>
                  </div>
                  {media.length > 0 && <><div className="photo-thumbnails">{media.map((image, index) => <div className="photo-thumbnail" key={image.id}><button type="button" className={coverId === image.id ? "selected" : ""} aria-label={`Use image ${index + 1} as cover`} aria-pressed={coverId === image.id} onClick={() => setCoverId(image.id)}><Image unoptimized src={image.url} fill sizes="100px" alt={`Story image ${index + 1}`}/>{coverId === image.id && <span>Cover</span>}</button><button type="button" className="remove-photo" aria-label={`Remove image ${index + 1}`} onClick={() => removeImage(image.id)}><Icon name="close" size={12}/></button></div>)}</div><p className="field-hint">Tap a photo to make it your cover. Readers can swipe through them all.</p></>}
                  <div className="cover-choice"><button type="button" className="text-button" aria-pressed={coverId === null} onClick={() => setCoverId(null)}><Icon name="spark" size={15}/>{coverId === null ? "Designed cover selected" : "Use a designed cover"}</button>{coverId === null && <label className="field">Cover style<select value={draft.cover} onChange={(event) => update("cover", event.target.value as CoverType)}>{covers.map((cover) => <option key={cover}>{cover}</option>)}</select></label>}</div>
                </section>
                <section className="composer-writing" aria-label="Write your story">
                  <label className="field title-field">Title<input value={draft.title} required maxLength={160} onChange={(event) => update("title", event.target.value)} placeholder="Give this moment a title…"/></label>
                  <label className="field">Your story<textarea rows={9} value={draft.body} onChange={(event) => update("body", event.target.value)} placeholder="What happened? What did you make, learn, or discover?"/></label>
                  <div className="field-row"><label className="field">Category<select value={draft.category} onChange={(event) => update("category", event.target.value as Category)}>{Object.entries(categories).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><label className="field">Tags<input value={draft.tags.join(",")} onChange={(event) => update("tags", event.target.value.split(","))} placeholder="Weekend, building, curiosity"/></label></div>
                  <details className="story-settings"><summary>More details <span>Date, links, places & more</span></summary><div className="settings-fields">
                    <label className="field">Card description<textarea rows={2} maxLength={500} value={draft.excerpt} onChange={(event) => update("excerpt", event.target.value)} placeholder="Optional — otherwise the first lines of your story appear."/></label>
                    <label className="field">Date<input type="date" required value={draft.date} onChange={(event) => update("date", event.target.value)}/></label>
                    <label className="field">Website or project link<input type="url" value={draft.link_url} onChange={(event) => update("link_url", event.target.value)} placeholder="https://…"/></label>
                  {draft.category === "hackathon" && (
                    <>
                      <span className="admin-divider">The hackathon</span>
                      <label className="field">
                        How did it go?
                        <select
                          value={draft.metadata.result ?? ""}
                          onChange={(e) =>
                            meta(
                              "result",
                              (e.target.value ||
                                undefined) as Post["metadata"]["result"],
                            )
                          }
                        >
                          <option value="">Not added yet</option>
                          <option value="winner">Won a prize</option>
                          <option value="finalist">Finalist</option>
                          <option value="participant">
                            Participated — no prize
                          </option>
                        </select>
                      </label>
                      <label className="field">
                        Award / result details
                        <input
                          value={draft.metadata.award ?? ""}
                          onChange={(e) => meta("award", e.target.value)}
                          placeholder="Event, track, and prize"
                        />
                      </label>
                    </>
                  )}
                  {draft.category === "life" && (
                    <>
                      <span className="admin-divider">
                        Duolingo progress (optional)
                      </span>
                      <div className="field-row">
                        <label className="field">
                          Current streak, in days
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={draft.metadata.streak ?? ""}
                            onChange={(e) =>
                              meta(
                                "streak",
                                e.target.value === ""
                                  ? undefined
                                  : Number(e.target.value),
                              )
                            }
                          />
                        </label>
                        <label className="field">
                          Total XP
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={draft.metadata.xp ?? ""}
                            onChange={(e) =>
                              meta(
                                "xp",
                                e.target.value === ""
                                  ? undefined
                                  : Number(e.target.value),
                              )
                            }
                          />
                        </label>
                      </div>
                      <label className="field">
                        Current section / level
                        <input
                          value={draft.metadata.section ?? ""}
                          onChange={(e) => meta("section", e.target.value)}
                          placeholder="e.g. Section 3, Unit 8"
                        />
                      </label>
                    </>
                  )}
                  {draft.category === "people" && (
                    <p className="field-hint">
                      Use the founder’s name in the title, their startup in the
                      tags, and tell the story of how you met. Add their website
                      above.
                    </p>
                  )}
                  <span className="admin-divider">
                    Add a pin to the map (optional)
                  </span>
                  <label className="field">
                    Place name
                    <input
                      value={draft.metadata.location ?? ""}
                      onChange={(e) => meta("location", e.target.value)}
                      placeholder="City, country"
                    />
                  </label>
                  <div className="field-row">
                    <label className="field">
                      Latitude
                      <input
                        type="number"
                        min={-90}
                        max={90}
                        step="any"
                        value={draft.metadata.lat ?? ""}
                        onChange={(e) =>
                          meta(
                            "lat",
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                          )
                        }
                      />
                    </label>
                    <label className="field">
                      Longitude
                      <input
                        type="number"
                        min={-180}
                        max={180}
                        step="any"
                        value={draft.metadata.lng ?? ""}
                        onChange={(e) =>
                          meta(
                            "lng",
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                          )
                        }
                      />
                    </label>
                  </div>
                    <label className="pin-option"><input type="checkbox" checked={draft.pinned} onChange={(event) => update("pinned", event.target.checked)}/> Pin to the top of my notebook</label>
                  </div></details>
                </section>
              </div>
              <div className="composer-actions"><span>{busy ? "Working…" : unsaved ? "Unsaved changes" : "All caught up"}</span><div>{!draft.published && <button type="button" className="secondary-button" disabled={preview} onClick={() => save(false)}>Save draft</button>}<button className="primary-button" disabled={preview}>{draft.published ? "Update story" : "Publish story"}<Icon name="right" size={16}/></button></div></div>
            </fieldset>
          </form>
        </>}
      </>}
      {message && <p className={`notice admin-message ${isError ? "error" : ""}`} role={isError ? "alert" : "status"}>{message}</p>}
      <dialog ref={deleteDialog} className="delete-story-dialog" aria-labelledby="delete-story-title" aria-describedby="delete-story-description" onClose={() => setDeleteTarget(null)} onCancel={(event) => { if (busy) event.preventDefault(); }}>
        {deleteTarget && <>
          <h2 id="delete-story-title">Delete this story permanently?</h2>
          <p id="delete-story-description"><strong>{deleteTarget.title}</strong> will be removed from your notebook and database. This cannot be undone.</p>
          <p className="field-hint">Uploaded photos remain in storage. To keep the story, cancel and use Hide story instead.</p>
          {deleteError && <p className="notice error" role="alert">{deleteError}</p>}
          <div className="delete-story-actions"><button className="secondary-button" autoFocus disabled={busy} onClick={() => setDeleteTarget(null)}>Cancel</button><button className="primary-button danger-button" disabled={busy} onClick={remove}>{busy ? "Deleting…" : "Delete permanently"}</button></div>
        </>}
      </dialog>
    </main>
  );
}
