'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ExternalLink, FileText, Loader2, Search, X } from 'lucide-react';
import type {
  CompanyProfile,
  ContractNature,
  TenderRecord,
  TenderRelevanceScore,
  TenderSearchResponse
} from '@/lib/types';

const buyerCountries = [
  { label: 'All countries', value: '' },
  { label: 'Germany', value: 'DEU' },
  { label: 'Austria', value: 'AUT' },
  { label: 'Switzerland', value: 'CHE' },
  { label: 'France', value: 'FRA' },
  { label: 'Italy', value: 'ITA' },
  { label: 'Spain', value: 'ESP' },
  { label: 'Netherlands', value: 'NLD' },
  { label: 'Belgium', value: 'BEL' },
  { label: 'Poland', value: 'POL' },
  { label: 'Greece', value: 'GRC' }
];

const contractNatureOptions: { label: string; value: ContractNature }[] = [
  { label: 'All contract types', value: 'all' },
  { label: 'Services', value: 'services' },
  { label: 'Supplies', value: 'supplies' },
  { label: 'Works', value: 'works' }
];

export default function TenderExplorer() {
  const [keyword, setKeyword] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [buyerCountry, setBuyerCountry] = useState('');
  const [contractNature, setContractNature] = useState<ContractNature>('all');
  const [page, setPage] = useState(1);
  const [response, setResponse] = useState<TenderSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TenderRecord | null>(null);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(true);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [aiScores, setAiScores] = useState<Record<string, TenderRelevanceScore>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const params = useMemo(() => {
    const search = new URLSearchParams({
      keyword,
      dateFrom,
      dateTo,
      buyerCountry,
      contractNature,
      page: String(page),
      limit: '10',
      scope: 'ACTIVE'
    });
    return search.toString();
  }, [keyword, dateFrom, dateTo, buyerCountry, contractNature, page]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/tenders?${params}`, {
          signal: controller.signal,
          cache: 'no-store'
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || 'Failed to load tenders');
        }

        setResponse(data);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError(err instanceof Error ? err.message : 'Failed to load tenders');
        }
      } finally {
        setLoading(false);
      }
    }

    void load();

    return () => controller.abort();
  }, [params]);

  const totalPages = response ? Math.max(1, Math.ceil(response.total / response.limit)) : 1;

  return (
    <main className="page-shell">
      {profileModalOpen ? (
        <CompanyProfileModal
          onClose={() => setProfileModalOpen(false)}
          onSubmit={(data) => {
            setProfileSubmitting(true);
            try {
              const iso3 = mapCountryToIso3(data.hqCountryInput);
              const cleanedKeywords = [data.keyword1, data.keyword2, data.keyword3]
                .map((k) => k.trim())
                .filter((k) => k.length > 0);

              const profileValue: CompanyProfile = {
                websiteUrl: data.websiteUrl.trim(),
                keywords: cleanedKeywords,
                hqCountryInput: data.hqCountryInput.trim(),
                hqCountryIso3: iso3 || undefined,
                contractNature: data.contractNature
              };

              setProfile(profileValue);

              if (cleanedKeywords.length) {
                setKeyword(cleanedKeywords.join(', '));
              }
              if (iso3) {
                setBuyerCountry(iso3);
              }
              if (data.contractNature) {
                setContractNature(data.contractNature);
              }
              setPage(1);
              setProfileModalOpen(false);
            } finally {
              setProfileSubmitting(false);
            }
          }}
          submitting={profileSubmitting}
        />
      ) : null}

      <section className="hero">
        <div>
          <p className="eyebrow">TED procurement explorer</p>
          <h1>A cleaner UI for TED tender search</h1>
          <p className="hero-copy">
            This interface keeps the data source on TED, but makes search and triage simpler: compact result cards,
            quick filters, and a modal for the full notice payload.
          </p>
        </div>
      </section>

      <section className="panel filters-panel">
        <div className="filters-grid">
          <label className="field field-search">
            <span>Keywords</span>
            <div className="search-input-wrap">
              <Search size={16} />
              <input
                value={keyword}
                onChange={(e) => {
                  setPage(1);
                  setKeyword(e.target.value);
                }}
                placeholder="e.g. SAP, ERP, cloud migration"
              />
            </div>
          </label>

          <label className="field">
            <span>Publication date from</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setPage(1);
                setDateFrom(e.target.value);
              }}
            />
          </label>

          <label className="field">
            <span>Publication date to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setPage(1);
                setDateTo(e.target.value);
              }}
            />
          </label>

          <label className="field">
            <span>Buyer country</span>
            <select
              value={buyerCountry}
              onChange={(e) => {
                setPage(1);
                setBuyerCountry(e.target.value);
              }}
            >
              {buyerCountries.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Contract nature</span>
            <select
              value={contractNature}
              onChange={(e) => {
                setPage(1);
                setContractNature(e.target.value as ContractNature);
              }}
            >
              {contractNatureOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="results-header">
        <div>
          <h2>Results</h2>
          <p>
            {loading
              ? 'Loading current TED notices…'
              : response
                ? `${response.total.toLocaleString()} notices found`
                : 'No data yet'}
          </p>
        </div>
        <div className="results-header-actions">
          {response?.query ? <code className="query-chip">{response.query}</code> : null}
          <div className="results-header-ai">
            <button
              type="button"
              className="ai-button"
              disabled={!response || loading || aiLoading || !profile}
              onClick={() => {
                void runAiScoring({
                  response,
                  profile,
                  setAiScores,
                  setAiLoading,
                  setAiError
                });
              }}
            >
              {aiLoading ? (
                <>
                  <Loader2 className="spin" size={14} />
                  <span>Scoring tenders…</span>
                </>
              ) : (
                <span>Score relevance with AI</span>
              )}
            </button>
            {aiError ? <span className="ai-error-text">{aiError}</span> : null}
            {!profile ? <span className="ai-hint-text">Set your company profile to enable AI scoring.</span> : null}
          </div>
        </div>
      </section>

      {error ? <div className="panel error-box">{error}</div> : null}

      <section className="results-list">
        {loading ? (
          <div className="panel loading-box">
            <Loader2 className="spin" size={18} />
            <span>Fetching notices from TED…</span>
          </div>
        ) : response?.tenders?.length ? (
          response.tenders.map((tender) => (
            <article key={tender.id} className="tender-card" onClick={() => setSelected(tender)}>
              <div className="tender-card-main">
                <div className="tender-card-topline">
                  {tender.noticeType ? <span className="badge">{tender.noticeType}</span> : null}
                  {tender.contractNature ? <span className="muted-pill">{tender.contractNature}</span> : null}
                  {tender.buyerCountry ? <span className="muted-pill">{tender.buyerCountry}</span> : null}
                  {aiScores[tender.id] ? (
                    <span className="badge ai-score-badge">
                      Relevance: {aiScores[tender.id].score}
                      /100
                    </span>
                  ) : null}
                </div>

                <h3>{tender.title}</h3>

                <div className="meta-line">
                  <span>
                    <CalendarDays size={14} />
                    Deadline: {formatDeadlineLabel(tender.deadline)}
                  </span>
                  {tender.buyerName ? <span>Buyer: {tender.buyerName}</span> : null}
                  {tender.publicationDate ? <span>Published: {formatDate(tender.publicationDate)}</span> : null}
                </div>

                <p className="description-preview">{truncate(tender.description, 260)}</p>
              </div>

              <div className="tender-card-actions" onClick={(e) => e.stopPropagation()}>
                {tender.tedHtmlUrl ? (
                  <a href={tender.tedHtmlUrl} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} />
                    Tender link
                  </a>
                ) : null}
                {tender.procurementDocsUrl ? (
                  <a href={tender.procurementDocsUrl} target="_blank" rel="noreferrer">
                    <FileText size={15} />
                    Auftragsunterlagen
                  </a>
                ) : null}
                {tender.submissionUrl ? (
                  <a href={tender.submissionUrl} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} />
                    Submission link
                  </a>
                ) : null}
                {!tender.procurementDocsUrl ? <span className="action-missing">No procurement docs URL returned</span> : null}
              </div>
            </article>
          ))
        ) : (
          <div className="panel empty-box">No tenders matched the current filters.</div>
        )}
      </section>

      <section className="pagination-row">
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading}>
          Previous
        </button>
        <div className="pagination-pages">
          {(() => {
            const maxVisible = 7;
            let pages: (number | 'ellipsis')[] = [];
            if (totalPages <= maxVisible) {
              pages = Array.from({ length: totalPages }, (_, i) => i + 1);
            } else {
              const showLeft = page <= 3;
              const showRight = page >= totalPages - 2;
              if (showLeft) {
                pages = [1, 2, 3, 4, 'ellipsis', totalPages];
              } else if (showRight) {
                pages = [1, 'ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
              } else {
                pages = [1, 'ellipsis', page - 1, page, page + 1, 'ellipsis', totalPages];
              }
            }
            return pages.map((p, i) =>
              p === 'ellipsis' ? (
                <span key={`ellipsis-${i}`} className="pagination-ellipsis">…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={p === page ? 'current' : undefined}
                  disabled={loading}
                  onClick={() => setPage(p)}
                  aria-current={p === page ? 'page' : undefined}
                >
                  {p}
                </button>
              )
            );
          })()}
        </div>
        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}>
          Next
        </button>
      </section>

      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">{selected.id}</p>
                <h3>{selected.title}</h3>
              </div>
              <button className="icon-button" onClick={() => setSelected(null)} aria-label="Close modal">
                <X size={18} />
              </button>
            </div>

            <div className="modal-summary-grid">
              <SummaryItem label="Buyer" value={selected.buyerName} />
              <SummaryItem label="Buyer country" value={selected.buyerCountry} />
              <SummaryItem label="Contract nature" value={selected.contractNature} />
              <SummaryItem label="Publication date" value={formatDate(selected.publicationDate)} />
              <SummaryItem label="Deadline" value={formatDeadlineLabel(selected.deadline)} />
              <SummaryItem label="Notice type" value={selected.noticeType} />
            </div>

            <div className="modal-links">
              {selected.tedHtmlUrl ? (
                <a href={selected.tedHtmlUrl} target="_blank" rel="noreferrer">
                  Open tender
                </a>
              ) : null}
              {selected.procurementDocsUrl ? (
                <a href={selected.procurementDocsUrl} target="_blank" rel="noreferrer">
                  Open Auftragsunterlagen
                </a>
              ) : null}
              {selected.submissionUrl ? (
                <a href={selected.submissionUrl} target="_blank" rel="noreferrer">
                  Open submission link
                </a>
              ) : null}
              {selected.tedPdfUrl ? (
                <a href={selected.tedPdfUrl} target="_blank" rel="noreferrer">
                  Open PDF
                </a>
              ) : null}
            </div>

            <div className="modal-section">
              <h4>Description</h4>
              <p>{selected.description}</p>
            </div>

            {selected.lots && selected.lots.length > 0 ? (
              <div className="modal-section">
                <h4>Lots</h4>
                {selected.lots.map((lot, index) => (
                  <div key={lot.internalId ?? index} className="lot-block">
                    <h5>{lot.internalId ? `Lot ${lot.internalId}` : `Lot ${index + 1}`}</h5>
                    {lot.title ? (
                      <p>
                        <strong>Lot title: </strong>
                        {lot.title}
                      </p>
                    ) : null}
                    {lot.description ? (
                      <p>
                        <strong>Lot description: </strong>
                        {lot.description}
                      </p>
                    ) : null}
                    {lot.smeSuitable !== undefined ? (
                      <div className="lot-general-info">
                        <h6>General information</h6>
                        <p>
                          This procurement is also suitable for small and medium-sized enterprises (SMEs):{' '}
                          {formatSmeLabel(lot.smeSuitable)}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}

function SummaryItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="summary-item">
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  );
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, max).trim()}…`;
}

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  }).format(date);
}

function formatDeadlineLabel(deadline?: string) {
  if (!deadline) return 'No deadline returned';
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return deadline;

  const now = new Date();
  const days = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} left`;
  if (days === 0) return 'Due today';
  return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
}

function formatSmeLabel(value?: string) {
  if (!value) return '—';
  const normalized = value.trim().toLowerCase();
  if (['true', 'yes', 'y', '1'].includes(normalized)) return 'Yes';
  if (['false', 'no', 'n', '0'].includes(normalized)) return 'No';
  return value;
}

function mapCountryToIso3(input: string): string {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return '';

  const exact = buyerCountries.find((c) => c.label.toLowerCase() === normalized);
  if (exact) return exact.value;

  const partial = buyerCountries.find((c) => c.label.toLowerCase().includes(normalized));
  if (partial) return partial.value;

  const iso = buyerCountries.find((c) => c.value.toLowerCase() === normalized);
  return iso?.value ?? '';
}

async function runAiScoring(args: {
  response: TenderSearchResponse | null;
  profile: CompanyProfile | null;
  setAiScores: (value: Record<string, TenderRelevanceScore>) => void;
  setAiLoading: (value: boolean) => void;
  setAiError: (value: string | null) => void;
}) {
  const { response, profile, setAiScores, setAiLoading, setAiError } = args;

  if (!response || !profile) return;
  if (response.total > 40) {
    setAiError('AI scoring is only available when 40 or fewer tenders are returned. Please narrow your filters.');
    return;
  }

  const tendersForAi = response.tenders.slice(0, 20).map((tender) => ({
    id: tender.id,
    title: tender.title,
    buyerCountry: tender.buyerCountry,
    contractNature: tender.contractNature,
    lots: tender.lots ?? []
  }));

  if (!tendersForAi.length) {
    setAiError('No tenders available to score.');
    return;
  }

  setAiLoading(true);
  setAiError(null);

  try {
    const res = await fetch('/api/ai/score-tenders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        profile,
        tenders: tendersForAi
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || 'Failed to score tenders with AI.');
    }

    const scoresArray = (data?.scores ?? []) as TenderRelevanceScore[];
    const map: Record<string, TenderRelevanceScore> = {};
    for (const item of scoresArray) {
      if (item?.tenderId) {
        map[item.tenderId] = item;
      }
    }
    setAiScores(map);
  } catch (error) {
    setAiError(error instanceof Error ? error.message : 'Failed to score tenders with AI.');
  } finally {
    setAiLoading(false);
  }
}

type CompanyProfileModalProps = {
  onClose: () => void;
  onSubmit: (data: {
    websiteUrl: string;
    keyword1: string;
    keyword2: string;
    keyword3: string;
    hqCountryInput: string;
    contractNature: ContractNature | 'all';
  }) => void;
  submitting: boolean;
};

function CompanyProfileModal({ onClose, onSubmit, submitting }: CompanyProfileModalProps) {
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [keyword1, setKeyword1] = useState('');
  const [keyword2, setKeyword2] = useState('');
  const [keyword3, setKeyword3] = useState('');
  const [hqCountryInput, setHqCountryInput] = useState('');
  const [contractNature, setContractNatureValue] = useState<ContractNature | 'all'>('services');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">Company profile</p>
            <h3>Tell us what you are looking for</h3>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close modal" disabled={submitting}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-section">
          <p>
            We will use this information to prefill the TED filters and later score tenders based on how well they
            match your company.
          </p>
        </div>

        <div className="profile-form-grid">
          <label className="field">
            <span>Website URL</span>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </label>

          <label className="field">
            <span>Keyword 1</span>
            <input
              value={keyword1}
              onChange={(e) => setKeyword1(e.target.value)}
              placeholder="e.g. SAP S/4HANA"
            />
          </label>

          <label className="field">
            <span>Keyword 2</span>
            <input value={keyword2} onChange={(e) => setKeyword2(e.target.value)} placeholder="Optional" />
          </label>

          <label className="field">
            <span>Keyword 3</span>
            <input value={keyword3} onChange={(e) => setKeyword3(e.target.value)} placeholder="Optional" />
          </label>

          <label className="field">
            <span>Country of company HQ</span>
            <input
              value={hqCountryInput}
              onChange={(e) => setHqCountryInput(e.target.value)}
              placeholder="e.g. Germany"
            />
          </label>

          <label className="field">
            <span>What do you sell? (contract nature)</span>
            <select
              value={contractNature}
              onChange={(e) => setContractNatureValue(e.target.value as ContractNature | 'all')}
            >
              <option value="services">Services</option>
              <option value="supplies">Supplies</option>
              <option value="works">Works</option>
              <option value="all">All types</option>
            </select>
          </label>
        </div>

        <div className="profile-modal-actions">
          <button className="secondary-button" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={submitting || !websiteUrl.trim() || !keyword1.trim()}
            onClick={() =>
              onSubmit({
                websiteUrl,
                keyword1,
                keyword2,
                keyword3,
                hqCountryInput,
                contractNature
              })
            }
          >
            {submitting ? 'Saving…' : 'Apply profile'}
          </button>
        </div>
      </div>
    </div>
  );
}

