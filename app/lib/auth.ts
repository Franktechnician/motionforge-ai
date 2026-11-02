import {NextRequest} from 'next/server';
import {timingSafeEqual} from 'crypto';
export function authorized(req:NextRequest){const expected=process.env.STUDIO_ACCESS_KEY;if(!expected||expected.length<16)return false;const supplied=req.headers.get('x-studio-key')||'';const a=Buffer.from(expected),b=Buffer.from(supplied);return a.length===b.length&&timingSafeEqual(a,b)}
