"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { postImages, type Post } from "@/lib/posts";
import Cover from "./Cover";
import Icon from "./Icon";

export default function PostGallery({ post }: { post: Post }) {
  const images = postImages(post);
  const slides: (string | null)[] = post.image_url ? images : [null, ...images];
  const [current, setCurrent] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  if (!images.length) return <Cover post={post}/>;
  function go(index: number) {
    const element = track.current;
    if (element) element.scrollTo({ left: index * element.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  return <section className="post-gallery" aria-label="Story photos" aria-roledescription="carousel">
    <div className="gallery-track" ref={track} onScroll={(event) => { const element = event.currentTarget; setCurrent(Math.round(element.scrollLeft / element.clientWidth)); }}>
      {slides.map((url, index) => <div className="gallery-slide" key={url ?? "cover"} role="group" aria-label={`${index + 1} of ${slides.length}`}>
        {url ? <Image src={url} alt={`${post.title} — photo ${post.image_url ? index + 1 : index}`} fill sizes="(max-width: 700px) 100vw, 760px"/> : <Cover post={post}/>}
      </div>)}
    </div>
    {slides.length > 1 && <div className="gallery-controls"><button className="icon-button" aria-label="Previous image" disabled={current === 0} onClick={() => go(current - 1)}><Icon name="left" size={16}/></button><span aria-live="polite">{current + 1} / {slides.length}</span><button className="icon-button" aria-label="Next image" disabled={current === slides.length - 1} onClick={() => go(current + 1)}><Icon name="right" size={16}/></button></div>}
  </section>;
}
