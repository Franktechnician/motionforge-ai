# Deploy MotionForge AI Studio to Vercel

1. Extract the ZIP. Upload the **contents** of this folder to the root of the `motionforge-ai` GitHub repository. `app/` and `package.json` must be siblings. Replace the previous project files; don't upload the enclosing folder or ZIP.
2. Verify `app/lib/auth.ts` exists and all three API routes import `../../lib/auth`.
3. In Vercel, import `Franktechnician/motionforge-ai` as a new Next.js project. Leave Root Directory empty.
4. Under Settings > Environment Variables, configure `REPLICATE_API_TOKEN` and a strong unique `STUDIO_ACCESS_KEY` (at least 16 characters). Do not commit actual credentials.
5. For generation modes other than image, configure compatible Replicate model identifiers using `REPLICATE_*_MODEL` environment variables. Different models require different inputs; use `REPLICATE_*_INPUT_MAP` where necessary. See README.md.
6. Deploy the **new commit**, not a redeployment of an old failed commit.

This is a private API-backed studio starter, not a production-ready clone of Kling AI. API access, billing, model compatibility, credits, accounts, and output persistence need further configuration and development.

Verification: source paths were checked; an npm dependency installation attempt timed out in this environment, so a clean `next build` has NOT been verified.
