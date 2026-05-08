# Website Audit Engine

**Professional Website Diagnostic & Evaluation Tool**

Automates the 6-point diagnostic framework (1.1–1.6), translates technical data into business-impact narratives, and generates professional PDF reports.

---

## ✨ Features

- **1.1** Core Web Vitals (Lighthouse: LCP, INP, CLS, Performance)
- **1.2** Traffic & Engagement Baseline (GA4 integration)
- **1.3** SEO/AEO Readiness (crawlability + AI visibility)
- **1.4** Indexing Errors & Broken Links (deep Playwright crawl)
- **1.5** Mobile Usability & HTTPS compliance
- **1.6** Schema & AEO Infrastructure (JSON-LD validation)

**Outputs:** Business narrative + Professional PDF + Technical raw data

---

## 🛠 Tech Stack

**Backend:** Node.js 20, TypeScript, Express, Lighthouse, Playwright, Google APIs, Puppeteer + EJS  
**Frontend:** Next.js 14, TypeScript, Tailwind CSS, Axios  
**Infrastructure:** Docker, Docker Compose, Redis

---

## 🚀 Quick Start

### Using Docker (Recommended)

```bash
git clone <your-repo-url>
cd website-audit-engine
cp .env.example .env
# Edit .env with your Google Service Account credentials
docker-compose up --build
```

Open http://localhost:3000

### Development Mode

**Terminal 1 (Backend):**
```bash
cd backend
npm install
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm install
npm run dev
```

---

## 📁 Project Structure

```
website-audit-engine/
├── backend/
│   ├── src/
│   │   ├── index.ts                    # Express entry point
│   │   ├── config/google.ts            # Google Auth
│   │   ├── services/
│   │   │   ├── lighthouse.service.ts   # Core Web Vitals
│   │   │   ├── crawler.service.ts      # Playwright deep crawl + AEO + Voice
│   │   │   ├── deepAudit.service.ts    # Orchestrator (the "brain")
│   │   │   ├── ga4.service.ts          # Traffic & Engagement
│   │   │   ├── gsc.service.ts          # Search Console
│   │   │   ├── report.generator.ts     # Report assembly
│   │   │   └── pdf.generator.ts        # PDF via Puppeteer
│   │   ├── routes/audit.routes.ts      # API endpoints
│   │   ├── utils/narrativeTemplates.ts # Business-language narratives
│   │   ├── types/index.ts              # TypeScript types
│   │   └── templates/report-template.ejs
│   └── Dockerfile
├── frontend/
│   └── src/app/page.tsx                # Next.js dashboard
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
└── reports/                            # Generated PDFs
```

---

## 🔑 Environment Variables

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
JWT_SECRET=your-jwt-secret
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## 📊 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/audit/start` | Standard audit (Lighthouse + Crawl) |
| POST | `/api/audit/deep` | Full audit with optional GA4 + GSC |

**Body:** `{ "url": "https://example.com", "includeGA4": false, "includeGSC": false }`

---

**Made to support high-quality website evaluation & client acquisition workflows.**
