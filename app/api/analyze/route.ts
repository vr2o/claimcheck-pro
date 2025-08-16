import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { extractContent } from '@/lib/extract';
import { detectLanguage } from '@/lib/lang';
import { searchAcrossProviders } from '@/lib/search';
import { scoreAll } from '@/lib/scoring';

// GET handler: return user-friendly analysis JSON by id
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const id = searchParams.get('id');
    if (!id) return jsonErr(400, 'Missing id');

    // Fetch analysis and sources
    const a = await prisma.analysis.findUnique({
      where: { id },
      include: { sources: true }, // This should be 'sources', not 'evidenceSources'
    });
    if (!a) return jsonErr(404, 'Not found');

    // Defensive: fallback if no sources
    const sourcesWithScores = (a.sources || []).map(s => ({ // This should be 'sources'
      url: s.url,
      title: s.title ?? '',
      language: s.language ?? '',
      domain: s.domain ?? '',
      sourceType: s.sourceType ?? '',
      discoveredVia: s.discoveredVia ?? '',
      snippet: s.snippet ?? '',
      publishDate: s.publishDate ? s.publishDate.toISOString() : '',
      credibilityScore: s.credibilityScore ?? 0,
      directnessScore: s.directnessScore ?? 0,
      methodologyScore: s.methodologyScore ?? 0,
      bias: s.bias ?? '',
      stance: s.stance ?? '',
      qualityScore: s.qualityScore ?? 0,
    }));
    // Debug: log sources and stances
    console.log('[analyze][GET] sourcesWithScores:', sourcesWithScores.map(s => ({ url: s.url, stance: s.stance, snippet: s.snippet })));

    // Compose user-friendly veracity analysis JSON (same logic as POST)
    let veracity_score = 50;
    if (a.qualityScore > 75) veracity_score = 90;
    else if (a.qualityScore > 60) veracity_score = 75;
    else if (a.qualityScore > 50) veracity_score = 60;
    else if (a.qualityScore > 25) veracity_score = 40;
    else if (a.qualityScore > 0) veracity_score = 20;
    else veracity_score = 0;

    let summary_statement = "This claim could not be verified.";
    if (veracity_score >= 75) summary_statement = "This claim appears to be true based on available evidence.";
    else if (veracity_score >= 60) summary_statement = "This claim appears to be mostly true, but some details may be unverified.";
    else if (veracity_score >= 40) summary_statement = "This claim has some support, but there are doubts or missing evidence.";
    else if (veracity_score >= 20) summary_statement = "This claim appears to be mostly false or lacks credible support.";
    else summary_statement = "This claim appears to be false or is not supported by evidence.";

    const supporting_evidence = sourcesWithScores
      .filter(s => s.stance === 'supporting')
      .map(s => s.snippet || s.title || s.url)
      .slice(0, 3);
    const contradictory_evidence = sourcesWithScores
      .filter(s => s.stance === 'challenging')
      .map(s => s.snippet || s.title || s.url)
      .slice(0, 3);

    const context_and_nuance = "This analysis is based on available public sources. Some claims may be difficult to verify due to lack of coverage or conflicting reports. Always consider the context and check multiple sources.";

    // Include stance in sources_checked
    const sources_checked = sourcesWithScores.slice(0, 5).map(s => ({
      name: s.domain || 'Unknown',
      link: s.url,
      assessment: s.snippet || s.title || '',
      stance: s.stance || 'neutral',
    }));

    return NextResponse.json({
      veracity_score,
      summary_statement,
      scale_labels: {
        left: "More likely False",
        right: "More likely True"
      },
      detailed_analysis: {
        supporting_evidence,
        contradictory_evidence,
        context_and_nuance,
        sources_checked
      }
    }, { status: 200 });
  } catch (e: any) {
    return jsonErr(500, e?.message ?? 'Internal error');
  }
}

export const runtime = 'nodejs';

function jsonErr(status: number, message: string, extra?: any) {
  return NextResponse.json({ error: message, ...(extra ?? {}) }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const input = (body?.input || '').toString().trim();
    const uiLang = (body?.uiLang || 'en').toString().trim() || 'en';
    const mode = (body?.mode || 'auto').toString().trim();

    if (!input) return jsonErr(400, 'Missing input');

    // Create DB row early so we have an id/share URL even if extraction fails
    const analysis = await prisma.analysis.create({
      data: {
        originalInput: input,
        claimText: '',           // will fill later
        claimLanguage: 'und',    // will fill later
        status: 'queued',
      },
      select: { id: true },
    });

    // Extraction (wrapped, never throws)
    let extracted: { title?: string; text?: string; notes?: string[] } = { notes: [] };
    try {
      extracted = await extractContent(input, { mode });
    } catch (e: any) {
      extracted = { text: '', notes: [`extract-failed: ${e?.message ?? 'unknown'}`] };
    }
    console.log('[analyze] Extracted:', extracted);

    // Language detection (fallback to UI lang)
    const lang = detectLanguage(extracted.text || input) || uiLang || 'en';

    // Choose claim text: prefer extracted text, else raw input
    const claim = (extracted.text || input).slice(0, 2000); // cap

    // Search across providers using the claim text (never throws)
    const searchRes = await searchAcrossProviders({
      query: claim,
      lang,
      includeCounterEvidence: body?.includeCounterEvidence ?? true,
      timeRange: body?.timeRange ?? '30d',
    }).catch((e: any) => ({
      results: [],
      providersTried: [],
      succeeded: [],
      failed: [{ name: 'all', reason: e?.message ?? 'search failed' }],
      notes: ['search-failed'],
    }));
    console.log('[analyze] Search results:', searchRes);

    // Score evidence (defensive)
    const scored = scoreAll({
      claim,
      language: lang,
      sources: searchRes.results || [],
      isPaid: false, // or set according to your logic
    });
    console.log('[analyze] Scoring output:', scored);

    // Debug before database operations
    console.log('[analyze] About to save sources, prisma:', typeof prisma);
    console.log('[analyze] Sources to save:', scored.sourcesWithScores?.length || 0);

    // Save sources to database with better error handling
    if (scored.sourcesWithScores && scored.sourcesWithScores.length > 0) {
      try {
        const sourcesToSave = scored.sourcesWithScores.map(s => ({
          analysisId: analysis.id,
          url: s.url,
          title: s.title || '',
          domain: s.domain || '',
          snippet: s.snippet || '',
          language: s.language || lang,
          sourceType: s.sourceType || '',
          discoveredVia: s.discoveredVia || '',
          publishDate: s.publishDate ? new Date(s.publishDate) : null,
          credibilityScore: s.credibilityScore || 0,
          directnessScore: s.directnessScore || 0,
          methodologyScore: s.methodologyScore || 0,
          qualityScore: s.qualityScore || 0,
          bias: s.bias || '',
          stance: s.stance || 'neutral',
        }));
        
        // Use evidenceSource (camelCase) for the Prisma client method
        await prisma.evidenceSource.createMany({
          data: sourcesToSave,
          skipDuplicates: true,
        });
        console.log('[analyze] Saved', scored.sourcesWithScores.length, 'sources to database');
      } catch (dbError: any) {
        console.error('[analyze] Database save error:', dbError);
        // Don't fail the whole request, just log the error
      }
    }

    // Debug: Verify sources were saved
    try {
      const savedSourcesCount = await prisma.evidenceSource.count({
        where: { analysisId: analysis.id }
      });
      console.log('[analyze] Verified sources saved:', savedSourcesCount);
    } catch (verifyError) {
      console.error('[analyze] Error verifying saved sources:', verifyError);
    }

    // Update analysis with final scores
    try {
      await prisma.analysis.update({
        where: { id: analysis.id },
        data: {
          claimText: claim,
          claimLanguage: lang,
          qualityScore: scored.eqs || 0,
          status: 'completed',
        },
      });
    } catch (updateError: any) {
      console.error('[analyze] Analysis update error:', updateError);
    }

    // Compose user-friendly veracity analysis JSON
    let veracity_score = 50;
    if (scored.eqs > 75) veracity_score = 90;
    else if (scored.eqs > 60) veracity_score = 75;
    else if (scored.eqs > 50) veracity_score = 60;
    else if (scored.eqs > 25) veracity_score = 40;
    else if (scored.eqs > 0) veracity_score = 20;
    else veracity_score = 0;

    let summary_statement = "This claim could not be verified.";
    if (veracity_score >= 75) summary_statement = "This claim appears to be true based on available evidence.";
    else if (veracity_score >= 60) summary_statement = "This claim appears to be mostly true, but some details may be unverified.";
    else if (veracity_score >= 40) summary_statement = "This claim has some support, but there are doubts or missing evidence.";
    else if (veracity_score >= 20) summary_statement = "This claim appears to be mostly false or lacks credible support.";
    else summary_statement = "This claim appears to be false or is not supported by evidence.";

    const supporting_evidence = scored.sourcesWithScores
      .filter(s => s.stance === 'supporting')
      .map(s => s.snippet || s.title || s.url)
      .slice(0, 3);
    const contradictory_evidence = scored.sourcesWithScores
      .filter(s => s.stance === 'challenging')
      .map(s => s.snippet || s.title || s.url)
      .slice(0, 3);

    const context_and_nuance = "This analysis is based on available public sources. Some claims may be difficult to verify due to lack of coverage or conflicting reports. Always consider the context and check multiple sources.";

    // Include stance in sources_checked
    const sources_checked = scored.sourcesWithScores.slice(0, 5).map(s => ({
      name: s.domain || 'Unknown',
      link: s.url,
      assessment: s.snippet || s.title || '',
      stance: s.stance || 'neutral',
    }));

    // Always return the analysis id for routing
    return NextResponse.json({
      id: analysis.id,
      veracity_score,
      summary_statement,
      scale_labels: {
        left: "More likely False",
        right: "More likely True"
      },
      detailed_analysis: {
        supporting_evidence,
        contradictory_evidence,
        context_and_nuance,
        sources_checked
      }
    }, { status: 200 });

  } catch (e: any) {
    // Last-resort catch: send JSON instead of HTML
    console.error('[analyze] fatal', e);
    return jsonErr(500, e?.message ?? 'Internal error');
  }
}