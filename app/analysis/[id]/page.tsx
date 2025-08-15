
import { ResultTypeIcon } from '@/components/ResultHelpers';


function getScoreColor(score: number) {
  if (score >= 75) return 'bg-green-100 text-green-800 border-green-400';
  if (score >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-400';
  if (score >= 40) return 'bg-orange-100 text-orange-800 border-orange-400';
  if (score >= 20) return 'bg-red-100 text-red-800 border-red-400';
  return 'bg-gray-100 text-gray-800 border-gray-400';
}

function Tooltip({ text, children }: { text: string, children: React.ReactNode }) {
  return (
    <span className="relative group focus-within:outline-none">
      {children}
      <span className="absolute left-1/2 -translate-x-1/2 mt-2 z-10 hidden group-hover:block group-focus-within:block bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg" role="tooltip">
        {text}
      </span>
    </span>
  );
}


async function fetchAnalysis(id: string | undefined) {
  if (!id) return null;
  let baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) {
    if (process.env.NODE_ENV === 'development') {
      baseUrl = 'http://localhost:3002';
    } else if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else if (process.env.HOSTNAME) {
      baseUrl = `https://${process.env.HOSTNAME}`;
    } else {
      baseUrl = 'http://localhost:3000';
    }
  }
  const url = `${baseUrl}/api/analyze?id=${encodeURIComponent(id)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

export default async function AnalysisPage({ params }: { params: { id?: string }}) {
  // Defensive: check for missing id
  if (!params?.id) return <main className="p-6">Not found (missing id)</main>;
  const data = await fetchAnalysis(params.id);
  if (!data) return <main className="p-6">Not found</main>;

  const scoreColor = getScoreColor(data.veracity_score);

  return (
    <main className="p-4 sm:p-10 max-w-3xl mx-auto bg-gradient-to-br from-slate-50 to-white min-h-screen">
      <h1 className="text-3xl font-bold mb-10 text-center tracking-tight">Veracity Analysis</h1>
      <div className="flex flex-col items-center mb-12">
        <Tooltip text="A higher score means the claim is more likely to be true, based on available evidence.">
          <div className={`rounded-full border-4 px-12 py-8 text-7xl font-extrabold shadow-md ${scoreColor} transition-all duration-200`} aria-label="Veracity score" tabIndex={0}>
            {data.veracity_score}
          </div>
        </Tooltip>
        <div className="mt-4 text-lg text-gray-600">
          <Tooltip text="This scale helps you understand what the score means.">
            <span>{data.scale_labels.left}</span> <span aria-hidden>—</span> <span>{data.scale_labels.right}</span>
          </Tooltip>
        </div>
        <div className="mt-8 text-2xl font-semibold text-center leading-snug max-w-2xl">
          <Tooltip text="This is a plain-language summary of the analysis.">
            {data.summary_statement}
          </Tooltip>
        </div>
      </div>

      <section className="mb-12">
        <div className="flex items-center gap-2 mb-3">
          <ResultTypeIcon type="claim" />
          <h2 className="font-semibold text-xl">Supporting Evidence</h2>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
          {data.detailed_analysis.supporting_evidence.length > 0 ? (
            <ul className="space-y-3">
              {data.detailed_analysis.supporting_evidence.map((ev: string, i: number) => (
                <li key={i} className="text-green-900 text-lg">
                  {ev}
                </li>
              ))}
            </ul>
          ) : <div className="text-gray-500">No supporting evidence found.</div>}
        </div>
      </section>

      <section className="mb-12">
        <div className="flex items-center gap-2 mb-3">
          <ResultTypeIcon type="link" />
          <h2 className="font-semibold text-xl">Contradictory Evidence</h2>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          {data.detailed_analysis.contradictory_evidence.length > 0 ? (
            <ul className="space-y-3">
              {data.detailed_analysis.contradictory_evidence.map((ev: string, i: number) => (
                <li key={i} className="text-red-900 text-lg">
                  {ev}
                </li>
              ))}
            </ul>
          ) : <div className="text-gray-500">No contradictory evidence found.</div>}
        </div>
      </section>

      <section className="mb-12">
        <div className="flex items-center gap-2 mb-3">
          <ResultTypeIcon type="media" />
          <h2 className="font-semibold text-xl">Context & Nuance</h2>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-blue-900 text-lg max-w-2xl">
          {data.detailed_analysis.context_and_nuance}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <ResultTypeIcon type="link" />
          <h2 className="font-semibold text-xl">Sources Checked</h2>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
          {data.detailed_analysis.sources_checked.length > 0 ? (
            <ul className="space-y-3">
              {data.detailed_analysis.sources_checked.map((src: any, i: number) => (
                <li key={i} className="text-gray-900 text-lg">
                  <a href={src.link} target="_blank" rel="noopener noreferrer" className="underline font-medium text-indigo-700 text-lg">{src.name}</a>
                  {src.assessment && <span className="ml-2 text-gray-600 text-base">{src.assessment}</span>}
                </li>
              ))}
            </ul>
          ) : <div className="text-gray-500">No sources found.</div>}
        </div>
      </section>
    </main>
  );
}
