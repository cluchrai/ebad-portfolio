# Muhammad Ebad Hafeez — Interactive 3D Portfolio

Semester project: an interactive 3D web portfolio with a Blender avatar, an After Effects promo video, a RAG chatbot and a working contact form.

The whole site plays out on one sunlit floating island built in Three.js. The 3D world stays fixed behind the page: as you scroll, the camera flies to a new shot for every section and the avatar reacts (waves at the character sheet, levels up at the inventory, pushes his glasses at the quest log, powers up his star pendant at the trophies). Sections are styled like a game: character sheet, inventory, quest log, save points, trophies, cutscene.

Avatar behaviour: idle breathing and random blinks; every 9–15 seconds a random move (glasses push, pendant power-up, level up showing the newest skill); click him for a peace-sign jump and a speech bubble that opens the chat; leave the page alone for 30 seconds and he sits down and falls asleep, then wakes up startled when you move.

## Tech stack

| Part | Tools |
|---|---|
| Frontend | React 19, Vite, Three.js via React Three Fiber + Drei, plain CSS with theme tokens |
| 3D avatar | Built from code (`blender/build_avatar.py`): Blender script for the .blend, plus a direct GLB exporter; loaded with `useGLTF`, played with `useAnimations` |
| Backend | Node.js, Express, Helmet, CORS, express-rate-limit, Zod |
| RAG chatbot | Upstash Vector (built-in embedding model) + Google Gemini |
| Email | Nodemailer over SMTP (Gmail App Password) |
| Deployment | Vercel (client), Render (server) |

## Project structure

```
portfolio/
├── client/                  React + Three.js site
│   ├── public/
│   │   ├── models/          avatar.glb goes here
│   │   ├── media/           CV PDF, promo.mp4
│   │   └── projects/        project thumbnails
│   └── src/
│       ├── data/portfolio.js   ALL site content (edit this)
│       ├── three/              World.jsx (island, camera shots), AvatarRig.jsx, Effects.jsx
│       └── components/         Hud, Hero, Sections, QuestLog, Contact, ChatWidget
├── blender/
│   ├── build_avatar.py      avatar model, rig and 11 animations (run inside Blender)
│   ├── export_glb.py        writes client/public/models/avatar.glb without Blender
│   └── preview.py           quick software renders of the avatar for checking poses
└── server/                  Express API
    ├── knowledge/           markdown the chatbot learns from
    ├── scripts/ingest.js    chunks knowledge and uploads to Upstash
    └── src/
        ├── routes/          contact.js, chat.js
        └── lib/             chunker.js, rag.js, mailer.js
```

## Setup

Requires Node.js 20 or newer.

### 1. Install

```bash
cd client && npm install
cd ../server && npm install
```

### 2. Get the keys

1. **Gemini:** create a key at https://aistudio.google.com/apikey
2. **Upstash Vector:** at https://console.upstash.com/vector create an index. Under *Embedding model* pick a built-in one such as `BAAI/bge-base-en-v1.5` (Upstash then creates the embeddings itself). Copy the REST URL and token.
3. **Gmail App Password:** turn on 2-Step Verification on the Google account, then create an App Password at https://myaccount.google.com/apppasswords

### 3. Configure

```bash
cd server
cp .env.example .env   # then fill in the values
```

### 4. Load the chatbot knowledge

```bash
cd server
npm run ingest
```

Run this again whenever you edit a file in `server/knowledge/`.

### 5. Run

Two terminals:

```bash
cd server && npm run dev     # API on http://localhost:5000
cd client && npm run dev     # site on http://localhost:5173
```

## How the RAG chatbot works

1. **Collect:** facts from the CV are written as markdown files in `server/knowledge/` (profile, skills, projects, experience, education, achievements).
2. **Chunk:** `chunker.js` splits each file by `##` heading, and splits long sections by paragraph (max ~900 characters). Each chunk is prefixed with its file title and heading so it carries its own context, and stores which portfolio section it belongs to.
3. **Embed and store:** `npm run ingest` uploads the chunks to Upstash Vector. The index's built-in embedding model turns each chunk into a vector.
4. **Retrieve:** for each question, `/api/chat` asks Upstash for the 5 nearest chunks (cosine similarity) and drops weak matches below a score of 0.55.
5. **Generate:** the matching chunks are numbered and sent to Gemini with a system prompt that only allows facts from those passages, and tells it to say "I don't have that information" otherwise. It replies in the visitor's language (English, Urdu or Roman Urdu).
6. **Cite:** Gemini lists the passage numbers it used. The server turns them into source chips that scroll the page to the matching section.

## Contact system security

- Validation on both sides: in the form (`Contact.jsx`) and with a Zod schema on the server
- Rate limit: 5 messages per visitor every 15 minutes
- Honeypot field and a link-count check; spam gets a fake success response
- Line breaks blocked in name and subject (stops email header injection), HTML escaped in the email body
- Credentials only in `server/.env`, which is git-ignored
- Helmet security headers, CORS limited to `CLIENT_ORIGIN`, 20 KB body limit

## Avatar (Module 2)

The avatar is modelled, rigged and animated in code, so it can be rebuilt any time.

- **Blender file:** open Blender → Scripting tab → open `blender/build_avatar.py` → Run Script. It builds the mesh, armature, materials and 11 actions, then saves `~/ebad_avatar/ebad_avatar.blend` and `~/ebad_avatar/avatar.glb`.
- **Without Blender:** `python3 blender/export_glb.py` (needs numpy) writes `client/public/models/avatar.glb` directly. This is the file the site ships with.
- Animations: Idle, Blink, Wave, GlassesPush, PendantGlow, LevelUp, PeaceJump, SitDown, Sleep, WakeUp, RubEyes.
- The newest skills shown by the LEVEL UP animation come from `recentSkills` in `src/data/portfolio.js`.

## Adding the video and thumbnails

- Export the After Effects video as `promo.mp4` into `client/public/media/`, then set `showreel.src` to `'/media/promo.mp4'`.
- Project thumbnails: put images in `client/public/projects/` and set each project's `image`, e.g. `'/projects/tiny-village.jpg'`.

## Deployment

**Backend on Render**
1. New → Web Service → connect the repo, root directory `server`
2. Build command `npm install`, start command `npm start`
3. Add every variable from `.env`, with `CLIENT_ORIGIN` set to the Vercel URL
4. **Email on Render's free tier:** Render blocks outbound SMTP (ports 25, 465, 587), so Gmail cannot be reached from there. Set `RESEND_API_KEY` instead (sign up at resend.com with the same address as `CONTACT_TO`). The server uses Resend's HTTPS API whenever that key is set, and falls back to SMTP otherwise (fine for local development).

**Frontend on Vercel**
1. New Project → import the repo, root directory `client` (Vite is detected automatically)
2. Add `VITE_API_URL` = the Render URL
3. Deploy

## Extra credit features included

- 3D objects that respond to the mouse (the avatar's head follows the cursor) and to clicks (raycast on the avatar)
- Animated avatar expressions and gestures on a schedule, on click, on inactivity and per section
- Voice input for the chatbot (Web Speech API, Chrome and Edge)
- Multilingual chatbot (English, Urdu, Roman Urdu)
- Chatbot source citations linking to portfolio sections
- Project filtering and search
- Accessibility: skip link, keyboard focus styles, ARIA labels, reduced-motion support (camera cuts instead of flying, no idle moves)

## Author

Muhammad Ebad Hafeez — ebadhafeez0504@gmail.com — [LinkedIn](https://linkedin.com/in/muhammad-ebad-hafeez)
