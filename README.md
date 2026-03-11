# TED Tender Explorer

A modern Next.js frontend for TED's official Search API.

## What this app does

- Calls the official TED Search API (`POST /v3/notices/search`)
- Builds filters as TED **expert queries**
- Shows results as compact stacked cards
- Opens a full modal with the complete returned notice payload
- Includes quick links for the TED notice and procurement documents URL when TED returns one

## Why this structure

The TED v3 Search API is built around a `query` string in TED's expert-search syntax plus a selected list of `fields`. According to the current official TED docs, the Search API for published notices is public and does not require authentication for this endpoint.

## Filters implemented

- Keyword search (`FT ~ (...)`)
- Publication date range (`publication-date`)
- Buyer country (`buyer-country`)
- Contract nature (`contract-nature`)

## Notes about TED metadata

TED notice metadata can vary by notice type and by whether the notice uses the newer eForms structure or older indexed formats. That means:

- some notices may not return a buyer name, contract nature, or procurement-documents URL
- some titles/descriptions may come from lot-level fields instead of procedure-level fields
- the `BT-15` procurement documents URL may be absent

The app is built defensively and shows fallbacks when those fields are missing.

## Install

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Main files

- `app/page.tsx` – main page
- `components/TenderExplorer.tsx` – filters, result cards, modal
- `app/api/tenders/route.ts` – server route that calls TED
- `lib/ted.ts` – TED query builder and response normalization

## Important implementation note

The most important difference from your snippet is this:

- your snippet sends JSON body fields directly, which is fine for transport
- but the actual filtering logic should be expressed in TED's **expert query language**

Example query built by the app:

```text
FT ~ (sap erp) AND publication-date = (20260101 <> 20260301) AND buyer-country = DEU AND contract-nature = services
```

## Official references used

- TED API docs: Search API overview
- TED help: expert search syntax, aliases, operators, and scopes
- TED eForms schema docs: procurement documents URL (`BT-15`)

## Production hardening you may want next

- debounce keyword input
- persist filters in URL state
- add sorting and saved searches
- map more TED metadata fields into a cleaner detail view
- add server-side caching with revalidation
- add favorites / tagging
