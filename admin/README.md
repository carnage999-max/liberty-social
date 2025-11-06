# Liberty Social Admin Dashboard

This is a lightweight Next.js application dedicated to management analytics. Deploy it separately from the consumer-facing frontend (e.g. on `admin.yourdomain.com`) so you can enforce stricter authentication, rate limits, and release cadences.

## Environment

Create an `.env.local` (or Amplify environment variables) with:

```
NEXT_PUBLIC_API_BASE_URL=https://<your-api-domain>/api
```

The dashboard authenticates against the existing `POST /users/login/` endpoint and requires the account to have `is_staff` privileges. Successful login stores the access token in `localStorage` and uses it for subsequent requests to `GET /users/metrics/summary/`.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run start
```

## Data sources

Metrics are served by the backend at `/users/metrics/summary/`, which is restricted to admin users via DRF's `IsAdminUser`. Update or extend that endpoint to expose additional KPIs as your reporting needs evolve.
