import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function AnalysisPage({ params }: { params: { id: string }}) {
  const a = await prisma.analysis.findUnique({ where: { id: params.id }, include: { sources: true }});
  if (!a) return <main className="p-6">Not found</main>;
  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Analysis</h1>
      <p className="text-sm text-gray-600 mb-4">Claim language: {a.claimLanguage} · EQS: {a.qualityScore ?? '-'} · SDI: {a.diversityIndex ?? '-'}</p>
      <h2 className="font-semibold">Claim</h2>
      <p className="mb-6">{a.claimText}</p>
      <h2 className="font-semibold mb-2">Sources</h2>
      <ul className="space-y-3">
        {a.sources.map(s => (
          <li key={s.id} className="border rounded p-3">
            <a href={s.url} target="_blank" className="underline">{s.title || s.url}</a>
            <div className="text-xs text-gray-600">{s.domain} · {s.sourceType} · stance: {s.stance}</div>
            <p className="text-sm mt-1">{s.snippet}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
