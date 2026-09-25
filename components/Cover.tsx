import Image from "next/image";
import type { Post } from "@/lib/posts";
import { safeUrl } from "@/lib/posts";
import Icon from "./Icon";

export default function Cover({ post }: { post: Post }) {
  if (safeUrl(post.image_url))
    return (
      <div className="cover image-cover">
        <Image
          src={post.image_url}
          alt={post.title}
          fill
          sizes="(max-width: 600px) 100vw, 400px"
        />
      </div>
    );
  return (
    <div className={`cover cover-${post.cover}`} aria-hidden="true">
      {post.cover === "studio" && (
        <>
          <span className="cover-kicker">AN INDEPENDENT VENTURE STUDIO</span>
          <div className="studio-title">
            Good things.
            <br />
            Built together<span>.</span>
          </div>
          <div className="dot-field">
            {Array.from({ length: 50 }, (_, i) => (
              <i key={i} className={i < 3 ? "filled" : ""} />
            ))}
          </div>
          <span className="cover-bottom">
            100things <Icon name="arrow" size={19} />
          </span>
        </>
      )}
      {post.cover === "ticket" && (
        <>
          <div className="ticket-top">
            <span>BUILD. BREAK. REPEAT.</span>
            <Icon name="spark" size={22} />
          </div>
          <div className="ticket-title">
            {post.tags[0] === "ETHGlobal" ? (
              <>
                ETHGlobal
                <br />
                <em>Brussels.</em>
              </>
            ) : (
              <>
                Ideas meet
                <br />
                <em>the road.</em>
              </>
            )}
          </div>
          <div className="ticket-stub">
            <span>
              {post.metadata.result === "winner"
                ? "✳ PRIZE WINNER"
                : post.metadata.result === "finalist"
                  ? "✳ FINALIST"
                  : post.metadata.result === "participant"
                    ? "✳ PARTICIPANT"
                    : "✳ FIELD NOTES"}
            </span>
            <span>{post.date.slice(0, 4)}</span>
          </div>
          <div className="ticket-barcode" />
        </>
      )}
      {post.cover === "spanish" && (
        <>
          <span className="cover-kicker">LIFELONG BEGINNER CLUB</span>
          <div className="hola">
            ¡Hola<span>!</span>
          </div>
          <div className="spanish-caption">un poco, cada día.</div>
          <div className="spanish-stamp">
            ES
            <br />
            <span>→ EN</span>
          </div>
          <div className="spanish-progress">
            {post.metadata.streak != null
              ? `${post.metadata.streak} day streak`
              : "One lesson at a time"}
            <span>↗</span>
          </div>
        </>
      )}
      {post.cover === "film" && (
        <>
          <div className="film-top">
            METASENT <span>● REC</span>
          </div>
          <div className="film-frame">
            <div className="film-disc" />
            <div className="film-window" />
            <span>
              MAKE
              <br />
              <em>the cut.</em>
            </span>
          </div>
          <div className="film-bottom">
            HUMAN IMAGINATION. NEW POSSIBILITIES. <span>▶</span>
          </div>
        </>
      )}
      {post.cover === "code" && (
        <>
          <span className="cover-kicker">SMALL TOOLS. OPEN POSSIBILITIES.</span>
          <div className="code-orbit">
            <span>{"{ }"}</span>
            <i className="orbit-node node-a">API</i>
            <i className="orbit-node node-b">↗</i>
            <i className="orbit-node node-c">✳</i>
          </div>
          <div className="code-bottom">
            <strong>free / for agents</strong>
            <span>OPEN SOURCE ↗</span>
          </div>
        </>
      )}
      {post.cover === "map" && (
        <>
          <span className="cover-kicker">COLLECT MOMENTS, NOT MILES.</span>
          <div className="map-cover-art">
            <Image src="/images/world.svg" alt="" fill />
            <span className="map-cover-pin">✳</span>
          </div>
          <span className="map-caption">
            Somewhere,
            <br />
            <em>something new.</em>
          </span>
          <span className="map-coordinates">
            {post.metadata.location ?? "A MAP IN PROGRESS"} ↗
          </span>
        </>
      )}
      {post.cover === "accounting" && (
        <>
          <span className="cover-kicker">
            A LITTLE CLARITY GOES A LONG WAY.
          </span>
          <div className="niffler-word">
            niffler<span>ai</span>
          </div>
          <div className="receipt">
            <span>Less paperwork.</span>
            <i />
            <strong>More possibility. ↗</strong>
          </div>
        </>
      )}
      {post.cover === "plant" && (
        <>
          <span className="cover-kicker">SIDE QUEST No. 01</span>
          <div className="plant-art">
            <div className="plant-stem" />
            <i />
            <i />
            <i />
            <i />
            <div className="plant-pot" />
            <span className="water-drop">✧</span>
          </div>
          <span className="plant-label">a little care, automated.</span>
        </>
      )}
      {post.cover === "shell" && (
        <>
          <span className="cover-kicker">AN EARLIER CHAPTER</span>
          <div className="shell-word">
            Big ideas.
            <br />
            <em>Real world.</em>
          </div>
          <div className="cover-bottom">
            SHELL <span>2015 — 2019</span>
          </div>
        </>
      )}
      {post.cover === "people" && (
        <>
          <span className="cover-kicker">GOOD PEOPLE, GOOD CONVERSATIONS.</span>
          <div className="people-art">
            hello<span>↗</span>
          </div>
          <div className="cover-bottom">A CONVERSATION WORTH SHARING</div>
        </>
      )}
      {post.cover === "note" && (
        <>
          <span className="cover-kicker">FROM THE EXPERIMENTAL CORNER</span>
          <div className="note-art">
            What if
            <br />
            <em>we tried?</em>
            <span>✳</span>
          </div>
          <div className="cover-bottom">SMALL IDEAS WELCOME HERE. ↗</div>
        </>
      )}
    </div>
  );
}
