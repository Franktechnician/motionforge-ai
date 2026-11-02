
import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";

export function authorized(req: NextRequest): boolean {
  const expected = process.env.STUDIO_ACCESS_KEY;
  const supplied = req.headers.get("x-studio-key") || "";

  if (!expected) {
    console.error("AUTH_ERROR: STUDIO_ACCESS_KEY_MISSING");
    return false;
  }

  if (!supplied) {
    console.error("AUTH_ERROR: REQUEST_KEY_MISSING");
    return false;
  }

  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);

  if (a.length !== b.length) {
    console.error("AUTH_ERROR: KEY_MISMATCH");
    return false;
  }

  const valid = timingSafeEqual(a, b);

  if (!valid) {
    console.error("AUTH_ERROR: KEY_MISMATCH");
  }

  return valid;
}
