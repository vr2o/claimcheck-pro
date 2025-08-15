import 'dotenv/config';
import { Worker, QueueEvents, Job } from 'bullmq';
import { PrismaClient, EvidenceSource as EvidenceSourceModel } from '@prisma/client';
import { getRedis } from './queue';
import { detectLanguage } from '@/lib/lang';
import { runSearch } from '@/lib/search';
import { assessCredibility } from '@/lib/assess/credibility';
import { scoreAll } from '@/lib/scoring';

const prisma = new PrismaClient();

async function publish(id: string, msg: any) {
  const redis = await getRedis();
  await redis.publish(`analysis:${id}`, JSON.stringify(msg));
}

async function handle(job: Job) {
  const { analysisId, options } = job.data as { analysisId: string; options: any };
  await publish(analysisId, { type: 'progress', data: { stage: 'extract', message: 'Extracting content…' }});

  // Minimal extraction for v1 (treat input as claim)
  const claimText: string = options?.input || '';
  const detectedLang = detectLanguage(claimText);

  await prisma.analysis.update({ where: { id: analysisId }, data: { claimText, claimLanguage: detectedLang }});
  await publish(analysisId, { type: 'progress', data: { stage: 'discover', message: 'Finding evidence…' }});

  const discovery = await runSearch({ claim: claimText, language: detectedLang, timeRange: options.timeRange || '30d', isPaid: !!options.isPaid });

  await publish(analysisId, { type: 'progress', data: { stage: 'assess', message: 'Assessing sources…' }});

  const assessed = await Promise.all(discovery.sources.map(async (s) => {
    const cred = assessCredibility(s.domain, s.sourceType, s.discoveredVia);
    return { ...s, credibilityScore: cred };
  }));

  const { eqs, sdi, sourcesWithScores, consensus } = scoreAll({ claim: claimText, language: detectedLang, sources: assessed, isPaid: !!options.isPaid });

  await prisma.$transaction(async (tx) => {
    await tx.analysis.update({ where: { id: analysisId }, data: { status: 'complete', qualityScore: eqs, diversityIndex: sdi, consensusData: consensus as any }});
    const records: Omit<EvidenceSourceModel, 'id'>[] = sourcesWithScores.map((s)=>({
      analysisId, url: s.url, title: s.title || null, language: s.language || null, domain: s.domain,
      sourceType: s.sourceType || 'unknown', discoveredVia: s.discoveredVia || 'search', snippet: s.snippet || '',
      publishDate: s.publishDate ? new Date(s.publishDate) : null, credibilityScore: s.credibilityScore ?? 0.5,
      directnessScore: s.directnessScore ?? 0.5, methodologyScore: s.methodologyScore ?? 0.5, bias: s.bias as any,
      stance: s.stance || 'neutral', qualityScore: s.qualityScore ?? 0.5, createdAt: new Date()
    }));
    if (records.length) await tx.evidenceSource.createMany({ data: records });
  });

  await publish(analysisId, { type: 'progress', data: { stage: 'done', message: 'Complete.' }});
  await publish(analysisId, { type: 'complete', data: { id: analysisId }});
}

async function main() {
  const concurrency = Number(process.env.WORKER_CONCURRENCY || '4');
  const worker = new Worker('analysis', handle, { connection: await getRedis() as any, concurrency });
  const qe = new QueueEvents('analysis', { connection: await getRedis() as any });
  qe.on('failed', async ({ jobId, failedReason }) => {
    if (!jobId) return;
    const job = await worker.getJob(jobId);
    const analysisId = job?.data?.analysisId as string | undefined;
    if (analysisId) {
      await prisma.analysis.update({ where: { id: analysisId }, data: { status: 'failed' }});
      await publish(analysisId, { type: 'error', error: failedReason || 'failed' });
    }
  });
  // eslint-disable-next-line no-console
  console.log('[worker] analysis.worker running with concurrency', concurrency);
}
main().catch((e)=>{ console.error(e); process.exit(1); });
