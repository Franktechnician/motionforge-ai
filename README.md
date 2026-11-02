# MotionForge AI Studio — Vercel API-powered project

This is a **working, access-key-protected creator studio starter** with a real Replicate text-to-image adapter, provider-configurable video and advanced modes, prediction polling, preview/download, browser-local history, and optional Vercel Blob reference uploads. **It is not a feature-complete Kling AI clone.** Advanced modes are adapter scaffolds, and only work after selecting models and matching their exact input schemas.

## Run locally

1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Set `STUDIO_ACCESS_KEY` to a random 32+ character secret and `REPLICATE_API_TOKEN` to your Replicate token.
5. Run `npm run dev`, visit http://localhost:3000, enter your studio access key, select Text to Image, and generate.

## Deploy to Vercel

1. Create a GitHub repository with these files and push to its main branch.
2. Import the repository at https://vercel.com/new (Next.js framework).
3. Set `STUDIO_ACCESS_KEY` and `REPLICATE_API_TOKEN` in Project → Settings → Environment Variables. Do not expose them as `NEXT_PUBLIC_` variables.
4. Deploy. Enter the studio access key in the UI when generating.
5. Optional uploads: Create a Vercel Blob store, connect it to the project, and set `BLOB_READ_WRITE_TOKEN`. Uploads use publicly readable Blob URLs; do not upload sensitive media.

## Modes and model configuration

| Mode | Env var | State |
| --- | --- | --- |
| Text to Image | `REPLICATE_IMAGE_MODEL` | Default `black-forest-labs/flux-schnell` adapter |
| Text to Video | `REPLICATE_TEXT_VIDEO_MODEL` | Needs compatible model |
| Image to Video | `REPLICATE_IMAGE_VIDEO_MODEL` | Needs compatible model |
| Image Edit | `REPLICATE_IMAGE_EDIT_MODEL` | Needs compatible model |
| Start/End Frames | `REPLICATE_START_END_MODEL` | Needs compatible model |
| Motion Control | `REPLICATE_MOTION_CONTROL_MODEL` | Needs compatible model |
| Lip Sync | `REPLICATE_LIP_SYNC_MODEL` | Needs compatible model |
| Video Extension | `REPLICATE_VIDEO_EXTEND_MODEL` | Needs compatible model |
| Effects | `REPLICATE_EFFECTS_MODEL` | Needs compatible model |

Set each model to an `owner/model` slug. Replicate models differ in supported parameters and may require model versions, different endpoints, or special schemas. The generic adapter sends `prompt`, `duration`, `aspect_ratio`, and media fields (`image`, `end_image`, `video`, `audio`, `motion_video`, `effect`) when supplied. To rename media fields, configure the corresponding `REPLICATE_*_INPUT_MAP` environment variable with a JSON map, e.g. `REPLICATE_IMAGE_VIDEO_INPUT_MAP={"imageUrl":"start_image"}`. For models that do not accept `duration`/`aspect_ratio`, modify `app/api/generate/route.ts` per the model documentation. This is an integration framework, **not guaranteed plug-and-play across all models**.

## Architecture

- Next.js App Router on Vercel
- `/api/generate` creates Replicate prediction (requires studio key)
- `/api/status` polls prediction status (requires studio key)
- `/api/upload` optionally stores small image/video/audio references in Vercel Blob (requires studio key)
- Browser localStorage stores up to 30 recent outputs. Provider URLs can expire.

## Production hardening required

This project is a **private single-operator studio**, not a public multiuser SaaS. Before offering paid accounts, implement authenticated user sessions, database-backed job records, durable output storage, background polling/webhooks, per-user quotas, rate limiting, moderation, credit charging with atomic transactions, payments, an admin console, and observability. The access key protects paid endpoints but does not replace proper user authentication and quotas. Blob upload size limit is 20 MB; large files need client uploads. Browser polling stops after about 4.5 minutes. Never publish your API keys or allow untrusted users access to the shared studio key.
