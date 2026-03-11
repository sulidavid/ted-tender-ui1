'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ExternalLink, FileText, Loader2, Search, X } from 'lucide-react';
import type { ContractNature, TenderRecord, TenderSearchResponse } from '@/lib/types';

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
  const [keyword, setKeyword] = useState('sap erp');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [buyerCountry, setBuyerCountry] = useState('');
  const [contractNature, setContractNature] = useState<ContractNature>('all');
  const [page, setPage] = useState(1);
  const [response, setResponse] = useState<TenderSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TenderRecord | null>(null);

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
        {response?.query ? <code className="query-chip">{response.query}</code> : null}
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
