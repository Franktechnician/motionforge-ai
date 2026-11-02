import { NextRequest, NextResponse } from 'next/server';
import { authorized } from '../../lib/auth';

export const runtime = 'nodejs';

type Mode =
  | 'image'
  | 'text_video'
  | 'image_video'
  | 'lip_sync'
  | 'motion_control'
  | 'video_extend'
  | 'effects'
  | 'start_end'
  | 'image_edit';

const allowed: Mode[] = [
  'image', 'text_video', 'image_video', 'lip_sync',
  'motion_control', 'video_extend', 'effects', 'start_end', 'image_edit'
];

const envKeys: Record<Mode, string> = {
  image: 'REPLICATE_IMAGE_MODEL',
  text_video: 'REPLICATE_TEXT_VIDEO_MODEL',
  image_video: 'REPLICATE_IMAGE_VIDEO_MODEL',
  lip_sync: 'REPLICATE_LIP_SYNC_MODEL',
  motion_control: 'REPLICATE_MOTION_CONTROL_MODEL',
  video_extend: 'REPLICATE_VIDEO_EXTEND_MODEL',
  effects: 'REPLICATE_EFFECTS_MODEL',
  start_end: 'REPLICATE_START_END_MODEL',
  image_edit: 'REPLICATE_IMAGE_EDIT_MODEL'
};

const needs: Partial<Record<Mode, string[]>> = {
  image_video: ['imageUrl'],
  lip_sync: ['videoUrl', 'audioUrl'],
  motion_control: ['imageUrl', 'motionUrl'],
  video_extend: ['videoUrl'],
  start_end: ['imageUrl', 'endImageUrl'],
  image_edit: ['imageUrl']
};

const fieldNames: Record<string, string> = {
  imageUrl: 'image',
  endImageUrl: 'end_image',
  videoUrl: 'video',
  audioUrl: 'audio',
  motionUrl: 'motion_video',
  effect: 'effect'
};

function validHttps(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json(
      { error: 'Invalid studio access key or STUDIO_ACCESS_KEY is not configured' },
      { status: 401 }
    );
  }

  try {
    const body: Record<string, unknown> = await req.json();
    const mode = body.mode;

    if (typeof mode !== 'string' || !allowed.includes(mode as Mode)) {
      return NextResponse.json({ error: 'Unsupported mode' }, { status: 400 });
    }

    const selectedMode = mode as Mode;
    const prompt = body.prompt;

    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 3000) {
      return NextResponse.json(
        { error: 'Prompt required (max 3000 characters)' },
        { status: 400 }
      );
    }

    // Cloudflare Workers AI: Text to Image only.
    if (selectedMode === 'image') {
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      const apiToken = process.env.CLOUDFLARE_API_TOKEN;

      if (!accountId || !apiToken) {
        return NextResponse.json(
          { error: 'Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in Vercel' },
          { status: 503 }
        );
      }

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt: prompt.trim().slice(0, 2048),
            steps: 4
          }),
          cache: 'no-store'
        }
      );

      const raw = await response.text();
      let data: {
        success?: boolean;
        result?: { image?: string };
        errors?: Array<{ message?: string }>;
      } = {};

      try {
        data = JSON.parse(raw);
      } catch {
        console.error('CLOUDFLARE_ERROR', response.status, 'Non-JSON response');
        return NextResponse.json(
          { error: 'Cloudflare returned an unexpected response' },
          { status: 502 }
        );
      }

      if (!response.ok || data.success === false) {
        const message = data.errors?.map((item) => item.message).filter(Boolean).join('; ')
          || `Cloudflare API error (${response.status})`;
        console.error('CLOUDFLARE_ERROR', response.status, message);
        return NextResponse.json({ error: message }, { status: 502 });
      }

      const image = data.result?.image;
      if (typeof image !== 'string' || !image) {
        console.error('CLOUDFLARE_ERROR', 'Missing image in response');
        return NextResponse.json(
          { error: 'Cloudflare returned no image' },
          { status: 502 }
        );
      }

      return NextResponse.json({
        id: `cloudflare-${crypto.randomUUID()}`,
        status: 'succeeded',
        output: [`data:image/jpeg;base64,${image}`]
      });
    }

    // Other modes retain their existing Replicate integration.
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'Set REPLICATE_API_TOKEN' }, { status: 503 });
    }

    const envKey = envKeys[selectedMode];
    const model = process.env[envKey];
    if (!model || !/^[\w.-]+\/[\w.-]+$/.test(model)) {
      return NextResponse.json(
        { error: `Configure ${envKey} with a compatible Replicate model` },
        { status: 400 }
      );
    }

    for (const key of needs[selectedMode] || []) {
      if (!validHttps(body[key])) {
        return NextResponse.json({ error: `Valid HTTPS ${key} required` }, { status: 400 });
      }
    }

    const input: Record<string, unknown> = {
      prompt: prompt.trim(),
      aspect_ratio: body.aspectRatio || '16:9',
      duration: Math.min(10, Math.max(5, Number(body.duration) || 5))
    };

    const mapName = envKey.replace('_MODEL', '_INPUT_MAP');
    let custom: Record<string, string> = {};

    try {
      const parsed: unknown = JSON.parse(process.env[mapName] || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Invalid map');
      }
      custom = parsed as Record<string, string>;
    } catch {
      return NextResponse.json({ error: `Invalid ${mapName} JSON` }, { status: 500 });
    }

    for (const [key, field] of Object.entries(fieldNames)) {
      const value = body[key];
      if (typeof value === 'string' && value.trim()) {
        const destination = custom[key] || field;
        if (typeof destination !== 'string' || !/^[a-zA-Z][\w]*$/.test(destination)) {
          return NextResponse.json(
            { error: `Invalid input mapping for ${key}` },
            { status: 400 }
          );
        }
        input[destination] = value;
      }
    }

    const response = await fetch(
      `https://api.replicate.com/v1/models/${model}/predictions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'wait=5'
        },
        body: JSON.stringify({ input }),
        cache: 'no-store'
      }
    );

    const data: {
      id?: string;
      status?: string;
      output?: unknown;
      detail?: unknown;
      error?: unknown;
    } = await response.json();

    if (!response.ok) {
      console.error('REPLICATE_ERROR', response.status, data.detail || data.error);
      return NextResponse.json(
        { error: String(data.detail || data.error || 'Provider error') },
        { status: response.status }
      );
    }

    return NextResponse.json({
      id: data.id,
      status: data.status,
      output: data.output
    });
  } catch (error) {
    console.error(
      'GENERATION_ERROR',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return NextResponse.json(
      { error: 'Generation request failed. Check server logs.' },
      { status: 500 }
    );
  }
}
