import { NextRequest } from 'next/server';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import { getRedis, getRedisPubSub } from '@/workers/queue';
import { ttlForTimeRange } from '@/lib/cache';
import { getClientIp, monthKey, secondsUntilMonthEnd } from '@/lib/utils';

const prisma = new PrismaClient();

const BodySchema = z.object({
  input: z.string().min(3),
  depth: z.enum(['quick','thorough']).optional(),
  includeCounterEvidence: z.boolean().optional(),
  timeRange: z.enum(['7d','30d','1y','all']).optional(),
  uiLang: z.string().optional(),
  mode: z.enum(['auto','text','image','video']).optional()
});

function hasAnyProvider() {
  const providers = (process.env.SEARCH_PROVIDERS || '').split(',').map(s => s.trim()).filter(Boolean);
  const anyKey =
    !!process.env.TAVILY_API_KEY ||
    !!process.env.SERPER_API_KEY ||
    !!process.env.SEMANTIC_SCHOLAR_API_KEY ||
    !!process.env.NEWS_API_KEY;
  return providers.length > 0 && anyKey;
}

function freeTierLimitKey(ip: string) {
  return `free:${monthKey()}:${ip}`;
}

async function checkAndIncQuota(ip: string) {
  const redis = await getRedis();
  const limit = Number(process.env.FREE_TIER_LIMIT || '10');
  const key = freeTierLimitKey(ip);
  const used = Number((await redis.get(key)) || '0');
  if (used >= limit) return false;
  const ttl = secondsUntilMonthEnd();
  await redis.multi().incr(key).expire(key, ttl).exec();
  return true;
}

export async function POST(req: NextRequest) {
  if (!hasAnyProvider()) {
    return new Response(JSON.stringify({ error: 'Missing search providers. Configure at least one provider key.', setupPath: '/setup' }), { status: 412, headers: { 'Content-Type': 'application/json' }});
  }
  let body;
  try { body = BodySchema.parse(await req.json()); } catch { return new Response(JSON.stringify({ error: 'Invalid request'}), { status: 400 }); }

  const ip = getClientIp(req) || '0.0.0.0';
  const isPaid = req.headers.get('x-paid-tier') === (process.env.PAID_TIER_SECRET || 'change_me');
  if (!isPaid) {
    const ok = await checkAndIncQuota(ip);
    if (!ok) return new Response(JSON.stringify({ code: 'FREE_TIER_EXCEEDED' }), { status: 429 });
  }

  const analysis = await prisma.analysis.create({
    data: { originalInput: body.input, claimText: '', claimLanguage: '', status: 'queued', isPublic: true }
  });

  const queue = new Queue('analysis', { connection: await getRedis() as any });
  await queue.add('analyze', { analysisId: analysis.id, options: { ...body, isPaid, cacheTTL: ttlForTimeRange(body.timeRange || '30d') } }, { removeOnComplete: true, removeOnFail: true });

  const sseUrl = `/api/analyze?stream=${analysis.id}`;
  return new Response(JSON.stringify({ id: analysis.id, sseUrl }), { status: 200 });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('stream');
  if (!id) return new Response('Missing stream id', { status: 400 });
  const { sub } = await getRedisPubSub();
  await sub.subscribe(`analysis:${id}`);

  const stream = new ReadableStream({
    start(controller) {
      function send(ev: string, data: unknown) {
        controller.enqueue(new TextEncoder().encode(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`));
      }
      (sub as any).on('message', (channel: string, payload: string) => {
        if (channel !== `analysis:${id}`) return;
        try {
          const msg = JSON.parse(payload);
          if (msg.type === 'progress') send('progress', msg.data);
          if (msg.type === 'complete') { send('complete', { ok: true }); controller.close(); }
          if (msg.type === 'error') { send('error', { error: msg.error || 'unknown' }); controller.close(); }
        } catch { send('error', { error: 'invalid message' }); controller.close(); }
      });
    }
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive' }});
}
