# Hono Website Audit API - Instructions for UI Developers

This document provides a comprehensive guide for building a user interface for the Hono Website Audit API. It includes detailed information on each endpoint, including its purpose, parameters, and example request/response cycles.

## Base URL

All API endpoints are relative to the base URL where the API is hosted. For local development, this is `http://localhost:3000`.

---

## 1. `GET /audit`

This is the main endpoint for performing a full, in-depth audit of a website.

-   **URL**: `/audit`
-   **Method**: `GET`
-   **Query Parameters**:
    -   `url` (required): The URL of the website to audit.
    -   `includeScreenshot` (optional): Set to `true` to include a screenshot in the audit results.
    -   `screenshotType` (optional): The format of the screenshot. Can be `jpeg` (default) or `png`.
    -   `screenshotQuality` (optional): The quality of the JPEG screenshot (1-100).

### Example Request

```bash
curl "http://localhost:3000/audit?url=https://example.com&includeScreenshot=true"
```

### Example Response

```json
{
  "url": "https://example.com/",
  "statusCode": 200,
  "metadata": {
    "lang": "en",
    "charset": "UTF-8",
    "viewport": "width=device-width, initial-scale=1"
  },
  "performance": {
    "loadTimeInMs": 721,
    "coreWebVitals": {
      "lcp": 1200,
      "fid": -1,
      "cls": 0
    }
  },
  "seo": {
    "title": "Example Domain",
    "description": "An example domain for use in documentation.",
    "metaTags": [],
    "ogTags": []
  },
  "content": {
    "h1": [
      {
        "textContent": "Example Domain"
      }
    ],
    "images": []
  },
  "resources": {
    "links": [],
    "scripts": []
  },
  "accessibility": {
    "violations": [],
    "violationSummary": {
      "critical": 0,
      "serious": 0,
      "moderate": 0,
      "minor": 0
    }
  },
  "security": {
    "headers": [
      {
        "name": "content-security-policy",
        "present": false
      }
    ]
  },
  "technologies": [
    {
      "name": "MockedTech",
      "version": "1.0",
      "categories": [
        {
          "name": "CMS"
        }
      ]
    }
  ],
  "screenshot": [
    {
      "filename": "_example_com_1635794880000.jpg",
      "url": "/screenshots/_example_com_1635794880000.jpg"
    }
  ]
}
```

---

## 2. `GET /audit/quick`

This endpoint performs a faster, customizable audit.

-   **URL**: `/audit/quick`
-   **Method**: `GET`
-   **Query Parameters**:
    -   `url` (required): The URL of the website to audit.
    -   `checks` (optional): A comma-separated list of checks to perform. Can include `seo`, `performance`, and `statistics`.

### Example Request

```bash
curl "http://localhost:3000/audit/quick?url=https://example.com&checks=seo,performance"
```

### Example Response

```json
{
  "url": "https://example.com/",
  "statusCode": 200,
  "title": "Example Domain",
  "description": "An example domain for use in documentation.",
  "loadTimeInMs": 721
}
```

---

## 3. `GET /audit/check`

This endpoint checks if a URL is accessible and returns SSL and DNS information.

-   **URL**: `/audit/check`
-   **Method**: `GET`
-   **Query Parameters**:
    -   `url` (required): The URL to check.

### Example Request

```bash
curl "http://localhost:3000/audit/check?url=https://example.com"
```

### Example Response

```json
{
  "accessible": true,
  "statusCode": 200,
  "finalUrl": "https://example.com/",
  "ssl": {
    "valid": true,
    "validFrom": "2023-01-01T00:00:00.000Z",
    "validTo": "2024-01-01T00:00:00.000Z",
    "issuer": "Let's Encrypt"
  },
  "dns": {
    "ipAddress": "93.184.216.34"
  }
}
```

---

## 4. `GET /health`

This endpoint checks the health of the API and its dependencies.

-   **URL**: `/health`
-   **Method**: `GET`

### Example Request

```bash
curl http://localhost:3000/health
```

### Example Response

```json
{
  "status": "ok",
  "timestamp": "2023-11-04T04:25:47.354Z",
  "service": "Website Audit API",
  "dependencies": {
    "browser": {
      "status": "ready",
      "version": "Chromium 119.0.0"
    }
  }
}
```
