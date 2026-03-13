export type ContractNature = 'services' | 'supplies' | 'works' | 'all';

export type TenderSearchParams = {
  keyword: string;
  dateFrom: string;
  dateTo: string;
  buyerCountry: string;
  contractNature: ContractNature;
  page: number;
  limit: number;
  scope: 'ACTIVE' | 'ALL' | 'LATEST';
};

export type TenderLot = {
  /** Internal lot identifier (BT-22-Lot) */
  internalId?: string;
  /** Lot title (BT-21-Lot) */
  title?: string;
  /** Lot description (BT-24-Lot) */
  description?: string;
  /** Raw SME suitability indicator (BT-726-Lot) */
  smeSuitable?: string;
};

export type TenderRecord = {
  id: string;
  title: string;
  description: string;
  noticeType?: string;
  publicationDate?: string;
  deadline?: string;
  buyerName?: string;
  buyerCountry?: string;
  contractNature?: string;
   /** Per-lot metadata derived from BT-21-Lot / BT-24-Lot / BT-22-Lot / BT-726-Lot */
  lots?: TenderLot[];
  tedHtmlUrl?: string;
  tedPdfUrl?: string;
  procurementDocsUrl?: string;
  submissionUrl?: string;
  raw: Record<string, unknown>;
};

export type TenderSearchResponse = {
  tenders: TenderRecord[];
  total: number;
  page: number;
  limit: number;
  query: string;
};

export type CompanyProfile = {
  websiteUrl: string;
  keywords: string[];
  hqCountryInput: string;
  hqCountryIso3?: string;
  contractNature: ContractNature | 'all';
};

export type TenderRelevanceScore = {
  tenderId: string;
  score: number;
  reason: string;
};
