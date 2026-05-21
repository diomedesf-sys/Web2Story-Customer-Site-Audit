# W2S Eval — System Overview

## What It Is

W2S Eval is a website diagnostic tool built for Web2Story. Its job is to audit a prospect's or client's website and produce three things:

1. **A story for the client** — written in plain English (and Spanish), explaining what is wrong with their site and why it matters to their business
2. **A work order for the developer** — a structured checklist of every problem found, with exact locations (CSS selectors, file URLs, HTML snippets) so nothing needs to be re-discovered
3. **A content package for the page builder** — everything needed to rebuild the site: all pages, images, color palette, structure, and the narrative

The tool is not a real-time monitor. It runs once per client, captures a snapshot of their site, and produces the deliverables. You audit, package, and move on.

---

## The Three Audiences

| Package | Audience | Contents |
|---|---|---|
| Narrative / Presentation | The client | Plain-English story, scores, opportunity framing |
| Dev Work Order | The developer | Every failing audit with element-level locations |
| Page Builder Package | The page rebuilder | Pages, images, palette, screenshots, narrative |

---

## The Four Audit Tools

Every audit runs against a single URL and saves its results as a JSON file on disk.

### Public Pulse
Captures the site's presence in the real world — not the code, but how the business appears to Google and to customers.
- Google Business Profile (name, rating, reviews, photos, posts)
- Domain age
- Google-indexed page count
- PageSpeed Insights field data (real users on real phones)
- Social profile bio check (does Instagram/Facebook link back to the right site?)

### Lighthouse
Google's own audit tool. Runs a simulated browser visit and grades the site on four dimensions.
- Performance (how fast it loads)
- SEO (how well Google can read it)
- Accessibility (how usable it is for people with disabilities)
- Best Practices (security, modern standards)

Also captures: Core Web Vitals, optimization opportunities with byte/time savings, tech stack, third-party entities, full-page screenshot.

### Site Crawler
Visits every page on the site the way Google does. Records what it finds on each page.
- Titles, meta descriptions, headings, word counts
- Images and alt text
- Schema markup and AEO readiness
- Open Graph tags
- Readability scores (Flesch / grade level)
- Color palette
- Broken links, console errors, canonical mismatches
- Screenshots of key pages
- robots.txt and sitemap analysis
- Social links and profile bio check
- hreflang tags

### Bilingual Audit
Analyzes the gap between the English and Spanish versions of the site.
- Spanish coverage percentage
- Translation gaps (English pages with no Spanish equivalent)
- Content parity (word count comparison per page pair)
- hreflang implementation
- Spanish readability scores

---

## How the Data Flows — The Pyramid

Everything in this tool follows a single direction: raw data at the bottom, human-readable output at the top. Nothing ever flows backward.

```
REPORTS / PACKAGES
(narrative, dev work order, page builder zip)
        ↑
assembled from multiple views/grids

VIEWS / GRIDS  (46 grids)
(what you see on screen — each <div id="...data">)
        ↑
one render function fills each grid

RENDER FUNCTIONS  (46)
(build the HTML cards)
        ↑
consume transform output

TRANSFORM FUNCTIONS  (22)
(reshape raw JSON into display-ready objects)
        ↑
read from memory

STATE  (browser memory)
(STATE.workspace.captures.lighthouse, .crawl, etc.)
        ↑
loaded once when workspace opens

JSON FILES  (disk)
(reports/nyavedental.com/lighthouse.json, crawl.json, etc.)
        ↑
written once when capture runs

CAPTURE SERVICES  (backend)
(lighthouse.service.ts, crawler.service.ts, etc.)
        ↑
triggered by clicking Run
```

### Layer by layer

**Capture Services** — TypeScript services running on the backend. Each one knows how to talk to a specific source: Lighthouse CLI, Playwright browser, Google APIs. They run when you click Run and never run again unless you explicitly re-run.

**JSON Files** — The permanent record. One file per capture per workspace, saved to `reports/{hostname}/`. These are never modified after capture. They are the source of truth for everything above them.

**STATE** — When you open a workspace in the browser, the frontend loads all JSON files into a single in-memory object. From this point on, no more server calls are needed to render views. Everything is local.

**Transform Functions (22)** — Pure functions that take raw JSON and return simple, display-ready arrays of objects. They contain all data logic: scoring, sorting, filtering, bucketing. They throw away fields the display doesn't need. This is where breadcrumbs (element-level detail) can be preserved or lost — it is a deliberate choice at this layer.

**Render Functions (46)** — Functions that take transform output and build HTML cards. They contain no data logic — only presentation. Each render function is responsible for exactly one grid.

**Views / Grids** — Each `<div id="...data">` in the HTML is a grid. One render function fills it. The grid is what the user sees. There are two types:
- **Pass/Fail grids** — each item is either working or broken (Lighthouse findings, broken links, missing alt text, hreflang issues, translation gaps)
- **Informational grids** — data that describes without judging (page inventory, color palette, screenshots, traffic by channel)

**Reports / Packages** — Assembled by reading across multiple grids and formatting for the target audience. A report is a selection of grids, not a re-processing of raw data.

---

## How the Files Are Organized

The project lives in one folder called `website-audit-engine`. Everything inside it has a clear job.

```
website-audit-engine/
│
├── backend/                        The server and everything it runs
│   │
│   ├── public/
│   │   └── index.html              THE entire frontend — one file
│   │                               All transforms, renders, grids, and
│   │                               report assembly live here
│   │
│   ├── src/
│   │   ├── server.ts               Entry point — starts Express
│   │   │
│   │   ├── routes/
│   │   │   ├── capture.routes.ts   POST /api/capture/* — runs the audits
│   │   │   ├── analyze.routes.ts   POST /api/analyze/* — bilingual, recommendations, narrative
│   │   │   └── workspace.routes.ts GET/PUT /api/workspace/* — loads and saves workspace data
│   │   │
│   │   ├── services/
│   │   │   ├── lighthouse.service.ts     Runs Google Lighthouse
│   │   │   ├── crawler.service.ts        Playwright browser crawl
│   │   │   ├── broad-traffic.service.ts  GBP scraper, PSI API, domain age, index count, social profiles
│   │   │   ├── bilingual.service.ts      Spanish coverage, parity, hreflang analysis
│   │   │   ├── recommendations.service.ts Synthesizes findings into prioritized action items
│   │   │   ├── narrative.service.ts      Generates the plain-English client story
│   │   │   ├── ga4.service.ts            Google Analytics 4 data pull
│   │   │   └── gsc.service.ts            Google Search Console data pull
│   │   │
│   │   ├── config/
│   │   │   └── google.ts           Google auth setup (service account or OAuth2)
│   │   │
│   │   └── types/                  TypeScript type definitions
│   │
│   └── .env                        Secrets — NEVER committed to git
│                                   Contains: GOOGLE_SERVICE_ACCOUNT_EMAIL,
│                                   GOOGLE_PRIVATE_KEY, GOOGLE_PSI_API_KEY,
│                                   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
│
├── reports/                        One folder per audited site
│   └── nyavedental.com/
│       ├── lighthouse.json         Raw Lighthouse result (LHR)
│       ├── crawl.json              Full crawl result — all pages, images, schema, etc.
│       ├── broad-traffic.json      GBP, PSI, domain age, index count, social checks
│       ├── bilingual.json          Coverage, gaps, parity, hreflang, readability
│       ├── recommendations.json    Synthesized action items
│       ├── narrative.json          Generated narrative sections
│       ├── ga4.json                GA4 data (only if client credentials provided)
│       ├── gsc.json                GSC data (only if client credentials provided)
│       └── screenshots/
│           ├── screenshot-home.png
│           ├── screenshot-contact.png
│           └── ...
│
├── W2S-EVAL-OVERVIEW.md            This document
├── IDEAS.md                        Improvement backlog (ranked by tier)
├── PENDING_DATA_GAPS.md            Data captured but not yet shown in UI
└── package.json
```

### Key principle

Every JSON file in `reports/{hostname}/` is written exactly once — when you click Run — and never touched again. It is the permanent record of what the site looked like at that moment. Everything the user sees in the browser is derived from those files. If you want a fresh reading, you run the capture again and it overwrites that file.

The frontend (`index.html`) never writes to disk. It only reads. All writes go through the backend routes in `capture.routes.ts` and `workspace.routes.ts`.

---

## The Tech Stack

- **Backend:** Node.js + Express + TypeScript
- **Frontend:** Single-file SPA (`backend/public/index.html`) — vanilla JavaScript only, no framework, no build step
- **Browser automation:** Playwright (crawler, GBP scraper, social profile checker, index count)
- **Lighthouse:** Google Lighthouse CLI (Node API)
- **APIs:** Google PageSpeed Insights, Google Analytics Data API (GA4), Google Search Console API
- **Auth:** Google OAuth2 / Service Account (stored in `.env`, never committed)
- **Storage:** Flat files on disk (`reports/{hostname}/`)

---

## What Is Not Built Yet

- **Dev Work Order** — the Presentation Package card is being repurposed for this; will harvest from pass/fail grids and include element-level breadcrumbs
- **Full Dump fix** — currently only packages `lighthouse.json`; should include all workspace artifacts
- **Recommendations redesign** — being redesigned as four-section checklist (Public Pulse / Lighthouse / Crawler / Bilingual) replacing the current impact-bucketed cards
- **Competitor capture** — `bt.competitor` object exists but capture logic always returns null; needs Playwright implementation
- **GA4 / GSC** — fully built, requires client credentials (service account added as viewer to their property)
