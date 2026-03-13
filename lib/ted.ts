import { z } from 'zod';
import type { ContractNature, TenderLot, TenderRecord, TenderSearchParams, TenderSearchResponse } from '@/lib/types';

const TED_API_URL = 'https://api.ted.europa.eu/v3/notices/search';

const DEFAULT_FILTER_CLAUSES = [
  'notice-type IN (pin-cfc-standard pin-cfc-social qu-sy cn-standard cn-social subco)'
  /*'procedure-type = open'*/
];

/**
 * These field names are chosen to keep the UI useful while staying close to TED's documented eForms/business-term naming.
 * The search endpoint is driven by the expert query syntax. Some metadata availability varies by notice format.
 */
const DEFAULT_TED_FIELDS = [
  'publication-number',
  'notice-type',
  'publication-date',
  'buyer-name',
  'organisation-name-buyer',
  'buyer-country',
  'contract-nature',
  'deadline-receipt-request',
  'links',
  'document-url-lot',
  'document-url-part',
  'submission-url-lot',
  'BT-15-Lot',
  'BT-15-Part',
  'BT-18-Lot',
  'BT-21-Lot',
  'BT-24-Lot',
  'BT-22-Lot',
  'BT-726-Lot',
  'BT-21-Procedure',
  'BT-24-Procedure'
];

const SearchParamsSchema = z.object({
  keyword: z.string().default(''),
  dateFrom: z.string().default(''),
  dateTo: z.string().default(''),
  buyerCountry: z.string().default(''),
  contractNature: z.enum(['services', 'supplies', 'works', 'all']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  scope: z.enum(['ACTIVE', 'ALL', 'LATEST']).default('ACTIVE')
});

export function parseSearchParams(input: unknown): TenderSearchParams {
  return SearchParamsSchema.parse(input);
}

export function buildTedExpertQuery(params: TenderSearchParams): string {
  const clauses: string[] = [...DEFAULT_FILTER_CLAUSES];

  const today = todayAsTedDate();
  clauses.push(`deadline-receipt-request >= ${today}`);

  if (params.keyword.trim()) {
    const rawParts = params.keyword.split(/[,\n]/);
    const parts = rawParts
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map((part) => part.replace(/"/g, ''));

    if (parts.length === 1) {
      clauses.push(`FT = ("${parts[0]}")`);
    } else if (parts.length > 1) {
      const combined = parts.map((p) => `"${p}"`).join(' OR ');
      clauses.push(`FT = (${combined})`);
    }
  }

  if (params.dateFrom && params.dateTo) {
    clauses.push(`publication-date = (${toTedDate(params.dateFrom)} <> ${toTedDate(params.dateTo)})`);
  } else if (params.dateFrom) {
    clauses.push(`publication-date >= ${toTedDate(params.dateFrom)}`);
  } else if (params.dateTo) {
    clauses.push(`publication-date <= ${toTedDate(params.dateTo)}`);
  }

  if (params.buyerCountry.trim()) {
    clauses.push(`buyer-country = ${params.buyerCountry.trim().toUpperCase()}`);
  }

  if (params.contractNature !== 'all') {
    clauses.push(`contract-nature = ${mapContractNature(params.contractNature)}`);
  }

  return clauses.length ? clauses.join(' AND ') : 'OJ = ()';
}

export async function searchTenders(params: TenderSearchParams): Promise<TenderSearchResponse> {
  const query = buildTedExpertQuery(params);

  const response = await fetch(TED_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      query,
      fields: DEFAULT_TED_FIELDS,
      limit: params.limit,
      page: params.page,
      scope: params.scope
    }),
    cache: 'no-store'
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TED API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const notices = Array.isArray(data?.notices) ? data.notices : [];

  return {
    tenders: notices.map(normalizeNotice),
    total: Number(data?.totalNoticeCount ?? notices.length ?? 0),
    page: params.page,
    limit: params.limit,
    query
  };
}

function normalizeNotice(notice: Record<string, unknown>): TenderRecord {
  const publicationNumber = readString(notice['publication-number']) || cryptoRandomId();
  const links = readObject(notice.links);
  const htmlLinks = readObject(links?.html);
  const pdfLinks = readObject(links?.pdf);

  const title =
    readLocalizedValue(notice['BT-21-Procedure']) ||
    readLocalizedValue(notice['BT-21-Lot']) ||
    readString(notice['title']) ||
    `TED Notice ${publicationNumber}`;

  const description =
    readLocalizedValue(notice['BT-24-Procedure']) ||
    readLocalizedValue(notice['BT-24-Lot']) ||
    'No description preview available from the returned TED metadata.';

  const procurementDocsUrl =
    readBt15(notice['document-url-lot']) ||
    readBt15(notice['document-url-part']) ||
    readBt15(notice['BT-15-Lot']) ||
    readBt15(notice['BT-15-Part']) ||
    readBt15(notice['BT-15']);

  const submissionUrl = readBt15(notice['submission-url-lot']) || readBt15(notice['BT-18-Lot']);

  const lots = extractLotsFromNotice(notice);

  return {
    id: publicationNumber,
    title,
    description,
    noticeType: readString(notice['notice-type']),
    publicationDate: readString(notice['publication-date']),
    deadline: coerceDeadline(notice['deadline-receipt-request']),
    buyerName: readLocalizedValue(notice['buyer-name']) || readString(notice['organisation-name-buyer']),
    buyerCountry: readString(notice['buyer-country']),
    contractNature: readString(notice['contract-nature']),
    lots,
    tedHtmlUrl: pickLanguageUrl(htmlLinks),
    tedPdfUrl: pickLanguageUrl(pdfLinks),
    procurementDocsUrl,
    submissionUrl,
    raw: notice
  };
}

function extractLotsFromNotice(notice: Record<string, unknown>): TenderLot[] | undefined {
  const titles = readLocalizedArray(notice['BT-21-Lot']);
  const descriptions = readLocalizedArray(notice['BT-24-Lot']);
  const internalIds = readStringArray(notice['BT-22-Lot']);
  const smeFlags = readStringArray(notice['BT-726-Lot']);

  const maxLen = Math.max(titles.length, descriptions.length, internalIds.length, smeFlags.length);
  if (!maxLen) return undefined;

  const lots: TenderLot[] = [];
  for (let i = 0; i < maxLen; i += 1) {
    lots.push({
      internalId: internalIds[i],
      title: titles[i],
      description: descriptions[i],
      smeSuitable: smeFlags[i]
    });
  }

  return lots;
}

function readBt15(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === 'string');
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of ['ENG', 'DEU', 'FRA', 'value', 'url']) {
      const candidate = obj[key];
      if (typeof candidate === 'string') return candidate;
    }
  }
  return undefined;
}

function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    const result: string[] = [];
    for (const item of value) {
      const str = readString(item);
      if (str) result.push(str);
    }
    return result;
  }
  const single = readString(value);
  return single ? [single] : [];
}

function mapContractNature(value: ContractNature): string {
  switch (value) {
    case 'services':
      return 'services';
    case 'supplies':
      return 'supplies';
    case 'works':
      return 'works';
    default:
      return value;
  }
}

function toTedDate(value: string): string {
  return value.replaceAll('-', '');
}

function todayAsTedDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return toTedDate(`${year}-${month}-${day}`);
}

function readString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) {
    const first = value.find((item): item is string => typeof item === 'string' && item.trim().length > 0);
    return first;
  }
  return undefined;
}

function readObject(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return undefined;
}

function readLocalizedValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = readLocalizedValue(item);
      if (resolved) return resolved;
    }
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const lang of ['ENG', 'DEU', 'FRA', 'ITA', 'ESP', 'NLD', 'POL', 'ELL']) {
      const candidate = obj[lang];
      if (typeof candidate === 'string' && candidate.trim()) return candidate;
    }
    for (const val of Object.values(obj)) {
      if (typeof val === 'string' && val.trim()) return val;
      if (Array.isArray(val)) {
        const nested = val.find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
        if (nested) return nested;
      }
    }
  }
  return undefined;
}

function readLocalizedArray(value: unknown): string[] {
  // Case 1: already an array of per-lot values
  if (Array.isArray(value)) {
    const result: string[] = [];
    for (const item of value) {
      const str = readLocalizedValue(item);
      if (str) result.push(str);
    }
    return result;
  }

  // Case 2: language-keyed object whose values are arrays of per-lot strings,
  // e.g. { deu: ["Los 1 ...", "Los 2 ..."] }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const lang of ['ENG', 'eng', 'EN', 'en', 'DEU', 'deu', 'DE', 'de', 'FRA', 'fra', 'FR', 'fr']) {
      const candidate = obj[lang];
      if (Array.isArray(candidate)) {
        const result: string[] = [];
        for (const item of candidate) {
          if (typeof item === 'string' && item.trim()) {
            result.push(item);
          }
        }
        if (result.length) return result;
      }
    }
  }

  // Fallback: treat as a single localized value
  const single = readLocalizedValue(value);
  return single ? [single] : [];
}

function pickLanguageUrl(value: Record<string, unknown> | undefined): string | undefined {
  if (!value) return undefined;
  for (const lang of ['ENG', 'DEU', 'FRA']) {
    const candidate = value[lang];
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }
  const first = Object.values(value).find((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return first;
}

function coerceDeadline(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const first = value.find((item): item is string => typeof item === 'string');
    return first;
  }
  if (value && typeof value === 'object') {
    const first = Object.values(value as Record<string, unknown>).find((item): item is string => typeof item === 'string');
    return first;
  }
  return undefined;
}

function cryptoRandomId(): string {
  return Math.random().toString(36).slice(2, 10);
}
