import { PrismaClient } from '@prisma/client';
import { getRedis } from '@/workers/queue';

const prisma = new PrismaClient();

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const r = await getRedis();
    await r.set('health:ping','1'); await r.del('health:ping');
    const providers = (process.env.SEARCH_PROVIDERS || '').split(',').filter(Boolean);
    const okProviders = Boolean(process.env.TAVILY_API_KEY || process.env.SERPER_API_KEY || process.env.SEMANTIC_SCHOLAR_API_KEY || process.env.NEWS_API_KEY);
    return new Response(JSON.stringify({ ok: true, db: true, redis: true, providersConfigured: providers, anyKey: okProviders }), { status: 200 });
  } catch (e:any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), { status: 500 });
  }
}
