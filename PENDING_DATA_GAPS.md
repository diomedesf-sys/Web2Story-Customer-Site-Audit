# Pending Data Gaps — Data Captured but Not Shown

These all exist in the JSON files on disk. None require re-crawling.

## HIGH VALUE

### 1. Bilingual parity table
- **Data:** `bilingual.json` → `parity[]` array
- **Fields:** `englishUrl`, `spanishUrl`, `englishWordCount`, `spanishWordCount`, `parityPercent`
- **Fix:** Add a new sub-view under Bilingual Audit showing a table of EN vs ES word counts per page pair
- **Why:** You can see *which* Spanish pages are thin but not *by how much*

### 2. Spanish readability scores
- **Data:** `bilingual.json` → `spanishReadability[]` array
- **Fields:** `url`, `easeScore`, `gradeLevel`, `isVoiceReady`
- **Fix:** Add a Spanish readability sub-view parallel to the existing English readability view in Crawler
- **Why:** We score English pages but the Spanish scores sit completely unused

### 3. Sitemap hreflang entries
- **Data:** `crawl.json` → `sitemap.hreflangEntries[]`
- **Fields:** sitemap-level `<xhtml:link>` hreflang declarations (separate from per-page hreflang tags)
- **Fix:** Surface in the Bilingual Audit → hreflang sub-view alongside per-page entries
- **Why:** Two separate hreflang systems exist; we only show one

### 4. Recommendation evidence
- **Data:** `recommendations.json` → each item has `evidence` string field
- **Example:** `"LCP is 17.9s, failing the 2.5s threshold"`
- **Fix:** Show `evidence` as a subtitle or tooltip on each recommendation card
- **Why:** Cards currently show action + source but not *why* the rec was triggered

## MEDIUM

### 5. Competitor section uses hardcoded fake data
- **Data:** `broad-traffic.json` → `competitor` object (`theyWin`, `competitorUrl`, `competitorScore`)
- **Fix:** `renderBroadTrafficCompetitor()` needs to read `bt.competitor` instead of its hardcoded values
- **Note:** `competitor` is always `{ theyWin: false, competitorUrl: null, competitorScore: null }` until the capture logic is built — but the render function should at least read the real object

### 6. Lighthouse performance — only 9 of ~30 audits shown
- **Data:** `lighthouse.json` → `categories.performance.auditRefs` (full list)
- **Fix:** Same pattern used for SEO & Best Practices — iterate all `performance` auditRefs, show failing + passing
- **Current hardcoded list:** unused-javascript, unused-css-rules, render-blocking-resources, uses-responsive-images, offscreen-images, uses-webp-images, uses-optimized-images, unminified-css, unminified-javascript
- **Missing examples:** uses-long-cache-ttl, dom-size, mainthread-work-breakdown, bootup-time, and ~20 more

### 7. og:description dropped from page cards
- **Data:** `crawl.json` → `totalPages[].ogTags.description`
- **Fix:** Add `og:description` row in the expandable page card detail view (alongside og:title and og:image)
- **Why:** We capture it but silently drop it in `transformCrawlerPages`

### 8. allImages[].foundOn always shows "/"
- **Data:** `crawl.json` → `allImages[]` — `foundOn` field is never set by the crawler
- **Fix:** In `crawler.service.ts`, when building `allImages`, set `foundOn` to the page URL where the image was found
- **Why:** The image inventory "Found on" column always shows `/` which is meaningless

## LOW / COSMETIC

### 9. robots.txt raw content not viewable
- **Data:** `crawl.json` → `robotsTxt.raw` (full text of the robots.txt file)
- **Fix:** Add a collapsible "View raw robots.txt" section in the Index Status or Crawler hub
- **Why:** We show blocked paths count but never the actual file

### 10. gbp.hasPosts never shown
- **Data:** `broad-traffic.json` → `gbp.hasPosts` (boolean, currently always false — hardcoded in service)
- **Fix:** Show alongside `hasPhotos` in the GBP card once the capture logic actually detects posts
- **Note:** Low priority until `hasPosts` detection is implemented in `broad-traffic.service.ts`

### 11. Capture timestamps never displayed
- **Data:** Every capture JSON has a `timestamp` field (ISO string)
- **Fix:** Show "Last captured: May 19, 2026" on each tool card or hub header
- **Why:** No way to tell how old the data is without checking the file system
