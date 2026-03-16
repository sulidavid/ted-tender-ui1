import { NextRequest, NextResponse } from 'next/server';
import type { CompanyProfile, TenderLot, TenderRecord, TenderRelevanceScore } from '@/lib/types';

export const dynamic = 'force-dynamic';

const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_PER_WINDOW = 5;

type Bucket = { count: number; windowStart: number };

const ipBuckets = new Map<string, Bucket>();

type TenderForAi = Pick<TenderRecord, 'id' | 'title' | 'buyerCountry' | 'contractNature'> & {
  lots: TenderLot[];
};

type ScoreRequestBody = {
  profile: CompanyProfile;
  tenders: TenderForAi[];
};

function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const now = Date.now();
    let bucket = ipBuckets.get(ip);

    if (!bucket || now - bucket.windowStart >= RATE_WINDOW_MS) {
      bucket = { count: 1, windowStart: now };
      ipBuckets.set(ip, bucket);
    } else if (bucket.count >= RATE_LIMIT_PER_WINDOW) {
      const waitMs = RATE_WINDOW_MS - (now - bucket.windowStart);
      const waitMin = Math.max(1, Math.ceil(waitMs / 60_000));
      return NextResponse.json(
        {
          error: `Too many AI evaluations. Please try again in about ${waitMin} minute(s).`,
        },
        { status: 429 },
      );
    } else {
      bucket.count += 1;
      ipBuckets.set(ip, bucket);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured on the server.' }, { status: 500 });
    }

    const json = (await request.json()) as ScoreRequestBody;

    if (!json?.profile?.websiteUrl || !Array.isArray(json.tenders)) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    if (json.tenders.length === 0) {
      return NextResponse.json({ scores: [] satisfies TenderRelevanceScore[] });
    }

    const profile = json.profile;
    const tenders = json.tenders.slice(0, 20);

    const prompt = buildScoringPrompt(profile, tenders);

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
          },
        }),
      },
    );

    if (!geminiResponse.ok) {
      const text = await geminiResponse.text();
      return NextResponse.json(
        { error: `Gemini API error ${geminiResponse.status}: ${text}` },
        { status: 502 },
      );
    }

    const data = await geminiResponse.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      data?.candidates?.[0]?.output_text ??
      '';

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Gemini response did not contain text output.' }, { status: 502 });
    }

    let parsed: unknown;
    try {
      const jsonStart = text.indexOf('[');
      const jsonEnd = text.lastIndexOf(']');
      const slice = jsonStart >= 0 && jsonEnd >= jsonStart ? text.slice(jsonStart, jsonEnd + 1) : text;
      parsed = JSON.parse(slice);
    } catch (err) {
      return NextResponse.json(
        { error: 'Failed to parse Gemini response as JSON.', raw: text },
        { status: 502 },
      );
    }

    if (!Array.isArray(parsed)) {
      return NextResponse.json(
        { error: 'Gemini response JSON was not an array.', raw: parsed },
        { status: 502 },
      );
    }

    const scores: TenderRelevanceScore[] = [];

    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as { tenderId?: unknown; score?: unknown; reason?: unknown };
      const tenderId = typeof obj.tenderId === 'string' ? obj.tenderId : undefined;
      const scoreNumber =
        typeof obj.score === 'number'
          ? Math.round(obj.score)
          : typeof obj.score === 'string'
            ? Number.parseInt(obj.score, 10)
            : NaN;
      const reason = typeof obj.reason === 'string' ? obj.reason : '';

      if (!tenderId || Number.isNaN(scoreNumber)) continue;

      const clampedScore = Math.max(0, Math.min(100, scoreNumber));

      scores.push({
        tenderId,
        score: clampedScore,
        reason: reason.slice(0, 500),
      });
    }

    return NextResponse.json({ scores });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildScoringPrompt(profile: CompanyProfile, tenders: TenderForAi[]): string {
  const companyBlock = [
    `Website URL: ${profile.websiteUrl}`,
    profile.keywords.length ? `Keywords: ${profile.keywords.join(', ')}` : undefined,
    profile.hqCountryInput ? `HQ Country (user input): ${profile.hqCountryInput}` : undefined,
    profile.hqCountryIso3 ? `HQ Country (ISO3): ${profile.hqCountryIso3}` : undefined,
    profile.contractNature && profile.contractNature !== 'all'
      ? `Contract nature focus: ${profile.contractNature}`
      : undefined,
  ]
    .filter(Boolean)
    .join('\n');

  const tendersBlock = tenders
    .map((tender, index) => {
      const lotsBlock =
        tender.lots && tender.lots.length
          ? tender.lots
              .map((lot, lotIndex) => {
                const lines: string[] = [];
                lines.push(
                  `    Lot ${lot.internalId ?? lotIndex + 1}: ${lot.title ?? 'Untitled lot'}`.trimEnd(),
                );
                if (lot.description) {
                  lines.push(`      Description: ${lot.description}`);
                }
                if (lot.smeSuitable) {
                  lines.push(`      SME suitable flag: ${lot.smeSuitable}`);
                }
                return lines.join('\n');
              })
              .join('\n')
          : '    No lot descriptions available.';

      return [
        `Tender #${index + 1}`,
        `  tenderId: ${tender.id}`,
        `  title: ${tender.title}`,
        tender.buyerCountry ? `  buyerCountry: ${tender.buyerCountry}` : undefined,
        tender.contractNature ? `  contractNature: ${tender.contractNature}` : undefined,
        `  lots:`,
        lotsBlock,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');

  return `
Be objective.
Don't hallucinate.
If you are unsure, then don't finish the task and instead return no scores.
Don't waste resources on long analysis.
Keep analysis short and clear.

1. Find out what the company at the given Website URL does and what kind of projects are a fit.
2. Treat this understanding as the "Company Profile Context".
3. Now you know about this company and what they offer and how their ideal client looks like.

After you have understood what the Website does / Company Profile Context,
go through Lot descriptions for each tender and give each tender a score from 0 to 100,
how relevant they are for that company. 0 = not relevant, 100 = highest relevance.

Only use the information given. Do not invent technologies, services, or project types.

Return STRICTLY a JSON array. Each element MUST have:
- "tenderId": string (must match exactly one of the tender ids provided)
- "score": number between 0 and 100
- "reason": short string (max two sentences)

If you are truly unable to assess relevance for any tender, return an empty JSON array [].

Input:

Company Profile:
${companyBlock}

Tenders:
${tendersBlock}
`.trim();
}

