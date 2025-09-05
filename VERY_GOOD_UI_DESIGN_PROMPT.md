# Very Good — UI Design & Frontend Handoff Prompt
This is a designer- and frontend-developer-focused, exhaustive brief for the Website Audit Dashboard UI. Paste this into your design system/ticketing tool or give it to a designer directly.

## Title
Website Audit Dashboard — UI & Interaction Spec (Full Handoff)

## High-level Goals
- Let users run Full Audits and Quick Audits of any website, with optional screenshots and downloads.
- Present results as Overview cards, Analytics (charts), Detailed findings (collapsible), Screenshots gallery, Accessibility report, and Raw JSON export.
- Make it usable for both non-technical users and developers (i.e., show both friendly summaries and full JSON).
- Provide complete mapping from UI actions (buttons/toggles) to backend endpoints and expected request/response behavior so frontend engineers can implement directly.

---

## Audience
- Product managers (summary, charts).
- QA / Support (screenshots, reproduction).
- Developers (raw JSON, detailed nodes).
- Accessibility engineers (WCAG-focused view).

---

## Primary Screens & Layout
- Header: App name "Website Audit".
- Main: two-column desktop layout:
  - Left column: Controls panel with URL input, options (Include Screenshot, Screenshot Type, Screenshot Quality, Download images, Detail level), run buttons, and recent URLs.
  - Right column: Results area with tabbed content: `Overview | Analytics | Details | Screenshots | Accessibility | Raw JSON`.
- Mobile: single column; controls collapse into a top collapsible panel; tabs convert to segmented controls or accordions.

---

## Controls (Left Column)
- `Website URL` input
  - Placeholder: `https://example.com`
  - Inline validation: "Please enter a URL" or "Include protocol (https://)"
- `Include Screenshot` (checkbox) — default: false
  - Tooltip: "Capture a screenshot during the audit (adds time and size)."
- `Screenshot Type` (dropdown: `jpeg` / `png`) — enabled only if `Include Screenshot` is checked. Default `jpeg`.
- `Screenshot Quality` (slider 0–100, default 80) — only enabled for `jpeg`.
  - Helper: "Higher = better clarity, larger files."
- `Download images` (checkbox) — when checked, UI should show "Download All" after results.
- `Result detail` (radio): `Overview` / `Analytics` / `Full Details` / `Raw JSON`.
- Buttons:
  - `Run Full Audit` (primary) — calls `/audit` with params.
  - `Run Quick Audit` (secondary) — calls `/audit/quick`.
  - `Accessibility Check` (link/tertiary) — calls `/audit/check`.
  - `Get Browser Info` (small link) — calls `/browser/info`.
- `Recent URLs` — collapsible list of last 5 runs (localStorage).

---

## Results Pane (Right Column)
Tabs and what they show:

- Overview
  - Cards: siteScore, performanceScore, accessibilityScore, seoScore, issuesCount.
  - Each card clickable to link to Detailed or Analytics tab filtered for that category.
  - Short timeline & last-run meta (timestamp).
- Analytics
  - Charts for key metrics (e.g., load time histogram, distribution of issues by severity, accessibility violation counts).
  - Top 10 issues table with severity and quick jump to details.
- Details
  - Collapsible sections (Performance, Accessibility, SEO, Best Practices).
  - Each issue shows: title, severity (High/Medium/Low), description, affected URLs/CSS selectors, steps to reproduce, suggested fix, optional “Open in code” link.
- Screenshots
  - Thumbnails grid.
  - Clicking thumbnail opens modal with full image, filename, type, download button.
  - If `Download images` was checked, show `Download All` button.
- Accessibility
  - WCAG categories (A/AA/AAA), failing elements list, code snippets showing selectors and HTML snippets.
- Raw JSON
  - Pretty-printed JSON view with `Copy` and `Download` buttons.

---

## Detailed UI to Endpoint Mapping (copy into designs)

### Run Full Audit — Primary button
- Endpoint: `GET /audit`
- Query params:
  - `url` (string, required)
  - `includeScreenshot` (`true` | `false`)
  - `screenshotType` (`jpeg` | `png`)
  - `screenshotQuality` (number 0–100)
  - `downloadImages` (`true` | `false`)
- Example:
  - `GET /audit?url=https%3A%2F%2Fexample.com&includeScreenshot=true&screenshotType=png&screenshotQuality=80&downloadImages=false`
- UI behaviour:
  - Disable `Run Full Audit` when in progress; show spinner in button and an overall progress area: "Queued • Running • Completed".
  - If `includeScreenshot=true` then expect `screenshots` list in response to render gallery.
  - If `downloadImages=true`, after success show `Download All` that triggers image downloads.

### Run Quick Audit — Secondary button
- Endpoint: `GET /audit/quick`
- Query params:
  - `url` (string, required)
- Example:
  - `GET /audit/quick?url=https%3A%2F%2Fexample.com`
- UI behaviour:
  - Show quick summary (Overview tab) with less detail. Allow expanding to Details if backend returns detail.

### Accessibility Check — Tertiary control
- Endpoint: `GET /audit/check`
- Query params:
  - `url` (string, required)
- Example:
  - `GET /audit/check?url=https%3A%2F%2Fexample.com`
- UI behaviour:
  - Focus results into `Accessibility` tab and highlight failing elements.

### Get Browser Info — Small link/button
- Endpoint: `GET /browser/info`
- No params
- UI behaviour:
  - Show modal with fields returned (userAgent, headless status, browser version, etc.) and a `Copy` button.

### Fetch Screenshot — UI gallery per-image
- Endpoint: `GET /screenshots/:name`
- Example:
  - `GET /screenshots/screenshot-1.png`
- UI behaviour:
  - Use `<img src="/screenshots/<name>">` or fetch blob to create object URL.
  - Provide `Download` button for each image.

---

## Error mapping & copy
Map backend error codes to UI messages:

- `MISSING_URL` → form inline error: "Please enter a URL to audit."
- `INVALID_URL` → form inline error: "The URL appears invalid. Make sure it starts with https://"
- `AUDIT_FAILED`, `QUICK_AUDIT_FAILED` → top toast: "Audit failed: {message}. Try again or contact support." + "Retry" action.
- `INTERNAL_ERROR` → modal: "Server error — please try again later. If the problem persists, copy error details and contact support." + Copy button.

Also show helpful UI for network failures / timeouts: "Network error. Check your connection and try again."

---

## Loading & Long-running behaviour
- Use spinner + text "Running audit — may take up to 30s".
- Show elapsed time.
- Allow user to `Cancel` (client-side) while request in-flight.
- Allow partial results display if server supports streaming (if not, show waiting state).
- For mobile, show compact spinner and collapse details until complete.

---

## Accessibility requirements for the UI
- All form controls must have labels.
- Tabs are keyboard accessible and follow WAI-ARIA practices.
- Color contrast AA for text and interactive elements.
- Images have alt text; screenshot thumbnails use `alt="Screenshot: <page path>"`.
- Notifications are announced to screen readers (aria-live).

---

## Deliverables requested from the designer
- High-fidelity mockups for desktop and mobile (3 breakpoints).
- Component library or tokens (colors, spacing, typography).
- Annotated handoff describing which UI element triggers which HTTP request and with what query params (use the Endpoint Mapping section).
- Interaction spec for loading, error, success, and download flows.
- Exportable assets for icons and screenshots modal.

---

## Frontend Developer: Example integration & fetch snippets
Use same-origin requests (UI served by server). All server endpoints are `GET`.

### Run Full Audit (example)
```javascript
// Run Full Audit
async function runFullAudit({ url, includeScreenshot = false, screenshotType = 'jpeg', screenshotQuality = 80, downloadImages = false }) {
  const qs = new URLSearchParams({
    url,
    includeScreenshot: includeScreenshot ? 'true' : 'false',
    screenshotType,
    screenshotQuality: String(screenshotQuality),
    downloadImages: downloadImages ? 'true' : 'false',
  });
  const res = await fetch(`/audit?${qs.toString()}`);
  if (!res.ok) {
    // expect JSON { error: 'CODE', message: '...' }
    const err = await res.json().catch(() => ({ error: 'UNKNOWN', message: 'Unknown error' }));
    throw err;
  }
  return res.json();
}
```

### Run Quick Audit (example)
```javascript
async function runQuickAudit(url) {
  const res = await fetch(`/audit/quick?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'UNKNOWN', message: 'Unknown error' }));
    throw err;
  }
  return res.json();
}
```

### Accessibility Check (example)
```javascript
async function checkAccessibility(url) {
  const res = await fetch(`/audit/check?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw await res.json();
  return res.json();
}
```

### Browser Info (example)
```javascript
async function getBrowserInfo() {
  const res = await fetch(`/browser/info`);
  if (!res.ok) throw await res.json();
  return res.json();
}
```

### Fetch one screenshot (for modal / preview)
```javascript
async function fetchScreenshotBlob(filename) {
  const res = await fetch(`/screenshots/${encodeURIComponent(filename)}`);
  if (!res.ok) {
    // If 404 or other, handle gracefully
    throw new Error(`Screenshot fetch failed: ${res.status}`);
  }
  return res.blob(); // then createObjectURL(blob)
}
```

### Download All screenshots (basic approach — no server zip)
- If backend doesn't provide a zip, the UI can fetch each image and trigger downloads:
```javascript
async function downloadAllScreenshots(filenames = []) {
  for (const name of filenames) {
    try {
      const res = await fetch(`/screenshots/${encodeURIComponent(name)}`);
      if (!res.ok) continue;
      const blob = await res.blob();
      const urlObj = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlObj;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(urlObj);
    } catch (e) {
      console.error('Failed to download', name, e);
    }
  }
}
```

- Alternative: Use `JSZip` in browser to bundle and download a single ZIP:
  - Add `jszip` (or include CDN).
  - Fetch each blob, add to zip, generate blob, and download. Fancy but requires adding library.

---

## Expected response shape (approximate, adapt if backend differs)
Frontend should be defensive (some fields may be missing).

Example success (audit):
```json
{
  "url": "https://example.com",
  "timestamp": "2025-08-30T12:00:00Z",
  "summary": {
    "siteScore": 74,
    "performanceScore": 70,
    "accessibilityScore": 85,
    "seoScore": 65,
    "issuesCount": 12
  },
  "details": {
    "performance": { "metrics": { "lcp": 2500, "fcp": 800 }, "issues": [ /* ... */ ] },
    "accessibility": { "violations": [ /* ... */ ] },
    "seo": { "issues": [ /* ... */ ] },
    "bestPractices": { /* ... */ }
  },
  "screenshots": [
    { "name": "screenshot-home.png", "type": "png", "path": "/screenshots/screenshot-home.png" }
  ]
}
```

Example error:
```json
{ "error": "INVALID_URL", "message": "Invalid URL provided" }
```

---

## UI Behaviours & Edge Cases
- Empty URL: show inline error (MISSING_URL).
- Invalid URL: show inline error (INVALID_URL).
- Slow response: show spinner + elapsed time + cancel option.
- Screenshot fetch 404: show placeholder image + retry button.
- Large images on mobile: show compressed preview, full download on user demand.
- Network error: show toast "Network error; please try again."

---

## Microcopy & Tooltips
- `Include Screenshot` → "Capture the page during the audit (adds time and storage)."
- `Download images` → "Download all captured screenshots after the audit completes."
- `Screenshot Quality` → "JPEG compression level (0–100). Higher = better quality, larger file."

---

## QA & Test Checklist (for frontend)
- Verify query string construction for `/audit` with all options.
- Verify `/audit/quick`, `/audit/check`, `/browser/info` calls and UI mapping.
- Verify screenshot fetching and per-image download.
- Verify `downloadImages` flows (both multiple downloads and zip approach if implemented).
- Validate all server error codes are handled.
- Accessibility test: keyboard navigation, ARIA on tabs, alt text for images.
- Test network and timeout behaviour.

---

## Handoff instructions for designers
- Deliver Figma/Sketch mockups with annotated mapping to endpoints (copy the Endpoint Mapping section).
- Export assets (icons) and provide spacing/typography tokens.
- Provide interactive prototype (optional) showing run flows and error states.

---

## Notes & Assumptions
- The exact backend JSON properties (`summary`, `details`, `screenshots`) are assumed; adapt to actual fields in `src/services/*.ts`. The UI should be defensive.
- All endpoints are `GET` on same origin as UI.
- Backend serves screenshots at `/screenshots/:name`.
- If you want server-side zip creation for images, update backend to provide a `downloadZipUrl` in `/audit` response when `downloadImages=true`.

---

## Final copy for the ticket (paste to your ticketing system)
Use the "High-level Goals", "Main screens", "Endpoint mapping", and "Deliverables requested" sections above. Attach the example requests and the `VERY_GOOD_UI_DESIGN_PROMPT.md` file for the designer. 