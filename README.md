# xyd.me — Yudi’s personal notebook

A small, scrollable personal website: projects, hackathons, hobby builds, travel pins, Spanish progress, and people worth knowing. The original Gemini-powered terminal is preserved at `/terminal/`, reachable from the site menu.

## Run locally

Node 22.6+ (for the small TypeScript test script).

```sh
npm ci
npm run preview
```

Open `http://localhost:8787`. With no Supabase configuration, the site shows the source-backed starter stories. `/admin/` offers a clearly labelled editor preview; it does not pretend to save anything.

## Connect Supabase

1. Choose or create a Supabase project.
2. Run both SQL files in `supabase/migrations/` in filename order in its SQL editor (once each), or apply them with the Supabase CLI. Existing installations only need the newer gallery migration; it preserves old cover images.
3. Add these **public** values to `.env.local` and to your Cloudflare build environment:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   Never put a service-role or secret key in a `NEXT_PUBLIC_` variable. Gemini has a separate Worker secret for the terminal (see below).

4. Use your manually created owner account in Supabase Authentication. With its user UUID, run:

   ```sql
   insert into public.site_admins (user_id)
   values ('YOUR_AUTH_USER_UUID')
   on conflict do nothing;
   ```

5. In **Authentication → Sign In / Providers**, turn **Allow new users to sign up** off and keep **Allow anonymous sign-ins** off. Leave Email enabled so your existing owner account can sign in. This server setting blocks direct signup API requests; the frontend's `shouldCreateUser: false` alone cannot do that. Configure the email OTP length to **6 digits** and use `{{ .Token }}` in the Supabase **Magic Link** email template to send a code. Configure SMTP for production email delivery.
6. Sign-in verifies the code on the studio page; no email link, redirect allowlist, or callback server is needed. Requests always use `shouldCreateUser: false`, including resends, so the app never creates an account.
7. Restart the local server or rebuild your deployment. Open `/admin/`, enter your existing owner email, then enter the emailed six-digit code. You can resend the code or change the email; Supabase enforces its configured resend limits and expiry.
8. Click **Import starter stories** once to populate the database. Repeating this only inserts missing starter IDs; it does not overwrite existing edits. Once Supabase is configured, the feed uses database rows, including an intentionally empty database. It never resurrects deleted stories from the fallback data.

## Update the notebook

The studio opens to your story library, with All / Drafts / Published filters. Click **New story**, drop up to 10 photos onto the composer (or select several from your device), then write your title and story. Tap any thumbnail to choose the feed cover, or choose a designed cover while keeping the photo gallery. Each image may be up to 8 MB. **Save draft** keeps the text private; **Publish story** makes it visible. Date, card description, links, map pins and other optional fields live under **More details**. Published stories have an **Update story** action.

Each library card has **Hide story** (or **Show story**) and **Delete story** controls. Hiding keeps the saved story in Drafts and removes it from public views; showing makes the saved version public again. The editor also has visible Hide and Delete buttons above the form. Hiding from the editor preserves unsaved edits without publishing or saving them. Delete opens a confirmation naming the story; **Delete permanently** removes its database row and cannot be undone. Uploaded images remain in Storage because other stories may reuse them.

- **Hackathons:** choose won a prize, finalist, or participated without a prize. Add award details.
- **Places:** give a city/country and latitude/longitude to add a clickable map pin. Any category can have a location.
- **Life lately:** manually update Duolingo streak, XP, and section. Numbers stay blank until provided; no unofficial Duolingo API or invented streak is used.
- **People:** use the founder’s name as the title, their startup as a tag, their website as the link, and your introduction as the story. No sample founder endorsements have been invented.
- **Projects / Playground:** link to the project or GitHub repository. Importing GitHub content is curated, not an ongoing sync.

Visitors can search, filter, open and share stories, and save cards in their own browser. Direct story links use `/?post=UUID`. Local and production use the same Supabase project URL and publishable key. Publishing updates the live feed on refresh, when the tab regains focus, or within 30 seconds while visible, without a website rebuild; changes to code or build environment variables require redeployment.

## Ask a local agent to prepare a story

Add the modern secret key to `.env.local` **only on your trusted computer**:

```dotenv
SUPABASE_SECRET_KEY=sb_secret_...
```

The frontend never imports this key. It is used only by `scripts/story.mts` and has elevated access, so keep it out of browser variables, commits, screenshots, and Cloudflare static assets. Project API keys do not apply SQL migrations; use the SQL editor, an authenticated Supabase CLI, or a direct database connection for schema setup.

An agent can write `.story-drafts/weekend/story.json` and put photos or generated illustration assets beside it:

```json
{
  "title": "A weekend of building",
  "body": "Write the story here.\n\nAnother paragraph.",
  "category": "hackathon",
  "tags": ["Weekend", "Building"],
  "images": ["photo.jpg", "cover.png"],
  "coverImage": 1,
  "cover": "ticket",
  "metadata": { "result": "participant" }
}
```

Image paths are relative to the JSON file. `coverImage` is a zero-based index; use `null` to display the designed `cover` instead. With images and no explicit selection, the first photo becomes the cover. Without images, a designed cover is used. Optional fields include `excerpt`, `date`, `link_url`, `pinned`, and the existing category metadata. The command always creates a **private draft**, regardless of a `published` value in the input.

```sh
npm run story:check -- .story-drafts/weekend/story.json
npm run story:push -- .story-drafts/weekend/story.json
```

The first command validates offline. The second uploads the images and saves a draft to Supabase, printing its `/admin/?edit=UUID` link. Open that link locally or on production, sign in, and edit the text, photos, cover style, tags and category before publishing. Each successful push creates a new draft. With multiple site owners, set `SUPABASE_OWNER_ID` to the intended owner UUID. `.story-drafts/` is git-ignored.

Generated illustrations can be uploaded just like photos. Use actual photos for personal events; the existing starter stories still use CSS covers.

## Terminal and Cloudflare Workers

The notebook, studio, and original terminal UI are a Next.js **static export** served by **Workers Static Assets**. The same Worker handles `/api/chat`, streams Gemini responses, and bundles the owner-authored `data/profile.md` as its knowledge source. Supabase remains the notebook’s Auth, PostgreSQL, and Storage backend. There is no Next.js server adapter or separate hosting backend.

The terminal retains KITT, the ASCII wordmark, conversation context, and streamed answers. `help` lists commands, `clear` starts a new conversation, and Stop / Escape cancels a response. Chats live in the current tab and are not stored in Supabase. The terminal profile is separate from database stories; edit `data/profile.md` and redeploy to update KITT’s reference material.

For local chat, copy `.dev.vars.example` to `.dev.vars` and set `GEMINI_API_KEY`. Keep the public Supabase values and optional local agent secret in `.env.local`. Wrangler is explicitly prevented from loading `.env.local`, so the Supabase secret is never passed to the Worker. Both secret files are git-ignored.

```sh
npm run preview
```

This builds the frontend and starts the complete app on port 8787. For fast UI iteration, leave the Worker running and run `npm run dev` in a second terminal. The development server on port 3000 proxies `/api/*` to the local Worker. Production serves both under the same origin.

Deploy with:

```sh
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
npm run deploy
```

Set the two `NEXT_PUBLIC_SUPABASE_*` variables in the Cloudflare **build environment**. `GEMINI_API_KEY` must be a Worker **runtime secret**, not a public frontend variable. The existing `gemini-2.5-flash` model is retained; `MODEL_ID` in `wrangler.jsonc` can be changed separately.

`wrangler.jsonc` defines the Worker, static assets, server-only Markdown import, and native chat rate limiter (10 requests per 10 seconds per IP per Cloudflare location). The chat endpoint accepts a bounded recent conversation and uses Cloudflare’s trusted client IP header. Other site routes are unaffected by the chat limit. The limit is approximate and is not a global spending cap.

The deployment target is the `xyd-me` Worker. Configure `xyd.me` as its custom domain when ready to switch the live site. No production deployment, domain change, commit, or PR is performed by local setup commands.

References: [Worker + static assets routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/), [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [Gemini streaming API](https://ai.google.dev/api/generate-content#method:-models.streamgeneratecontent).

## Access rules and storage

- Public users can only read published posts.
- Authenticated accounts need membership in `site_admins` to read drafts or mutate posts.
- Site admin membership cannot be created or changed by a browser user. It is managed in the SQL editor.
- Disable public signup in Supabase Auth, not just in the frontend. Signing in, editing user metadata, or knowing the publishable key does not grant membership in `site_admins`.
- `post-images` allows owner uploads to the owner’s UUID folder only, with an 8 MB limit and raster image MIME allowlist.
- Image files are **public assets**, including uploads attached to drafts. Draft text is private. Do not upload confidential media.
- Failed upload batches and definitively rejected database writes clean up their new uploads. If a database response is lost, files are retained because the write may have committed; check the story list before retrying. Images from replaced/deleted stories are retained because another story may reuse them; unused files can be removed in Supabase Storage.
- The frontend needs only a public Supabase key. Row-level security is the authorization boundary.

## Checks

```sh
npm test
npm run lint
npm run typecheck
npm run build
npx wrangler deploy --dry-run
```

`npm test` covers published/draft filtering, search, saved entries, safe links, date/coordinate/progress validation, gallery limits, upload rollback, uncertain write responses, the agent draft workflow, and runs both actual migrations in an isolated PGlite PostgreSQL instance. It verifies anonymous and non-owner restrictions, owner writes, no self-promotion, storage folder ownership, and database constraints. Terminal checks cover request validation, rate limiting, secret handling, Gemini request construction, streamed Unicode, provider failures, and cancellation. Email OTP checks use a mocked transport to verify that requests and resends disable signup, codes retain leading zeroes, malformed/expired codes cannot sign in, and valid verification establishes a session. Test Auth/Storage schemas imitate Supabase’s SQL interfaces; hosted email delivery and actual Storage uploads still require an integration check against your configured Supabase project.

The first version loads the notebook in one query (up to Supabase’s default row limit). Add pagination if it grows beyond a small personal notebook. Each shared story uses the site-wide social metadata; per-story crawler previews would require server rendering or publishing-time page generation.

## Content and visual sources

- [GitHub profile](https://github.com/xyd945) and the owner’s public repositories, checked 24 September 2026.
- [100things](https://100things.nl): Niffler AI and Metasent are on the workbench; MobiFi, DeTrip and H2O are earlier, closed chapters.
- Existing owner-authored `data/profile.md`: Shell history, awards, hackathons, and the Zurich chapter. Kept as the terminal’s knowledge source; notebook stories live in Supabase.
- [LinkedIn](https://www.linkedin.com/in/xuyudi/) matched the existing profile link. Public search excerpts confirmed the Dutch Mobility award; the full profile was not accessible to the research tool.
- Avatar: the owner’s [public GitHub avatar](https://github.com/xyd945.png), stored locally.
- Map: simplified [Natural Earth boundaries via datasets/geo-countries](https://github.com/datasets/geo-countries), public-domain geographic data. Pins reflect chapters in the provided profile, not a claimed complete travel history.
- All other covers are original CSS/typographic designs. No generated photos or stock photos are presented as personal travel photos.

Undated introductory entries carry the editorial date, 24 September 2026. Older entries use their event date or the first day of the documented month; these are editable. Copy is a proposed English first draft for the owner to review.
