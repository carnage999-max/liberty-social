Frontend Integration Guide

This document describes how to integrate a frontend (React / Vue / Svelte / etc.) with the backend API in this repository.

Base URL

- When running the Django backend locally (development): http://localhost:8000/
- API endpoints are under the app URLs. Example: http://localhost:8000/api/posts/

Authentication

- The project uses JWT (djangorestframework-simplejwt).
- Obtain token by POSTing credentials to the token endpoint (e.g. /api/token/).
- Include the access token in requests as an Authorization header:

  Authorization: Bearer <access_token>

CORS

- The backend must allow the frontend origin. During local development enable CORS for the frontend origin (for example http://localhost:3000).
- The backend ships with a `.env.template` in the repo — copy to `.env` and add AWS / Django settings as needed.

Media uploads (images/videos)

- The backend stores only S3 URLs for media. The frontend should upload files to the backend uploads endpoint which will return an S3 URL (or pre-signed URL depending on configuration).
- Example flow:
  1. Frontend POSTs a multipart/form-data with the file to /api/uploads/images/.
  2. Backend returns JSON {"url": "https://...s3.amazonaws.com/..."}.
  3. Frontend includes that URL in the `media_urls` field when creating a post.

API notes & common endpoints

- Posts: GET/POST/PUT/PATCH/DELETE at /api/posts/ (Post creation accepts `media_urls` list of URLs — write-only)
- Comments: /api/comments/
- Reactions: /api/reactions/ (accepts either `post` or `comment` id when creating)
- Bookmarks: /api/bookmarks/
- Uploads: /api/uploads/images/ (multipart upload -> returns `url`)
- Profile picture upload: /api/users/profile_picture/ (multipart upload -> returns `url` and updates the user profile)

Environment variables

- See `.env.template` for required AWS and Django settings. Common vars to set:
  - DJANGO_SECRET_KEY
  - DJANGO_DEBUG (True/False)
  - AWS_ACCESS_KEY_ID
  - AWS_SECRET_ACCESS_KEY
  - AWS_S3_BUCKET
  - AWS_REGION
  - S3_PUBLIC_BASE_URL (if you want to override)

Example fetch request (create post with uploaded images)

```js
// assume `token` contains a valid access token
const createPost = async (content, imageUrls) => {
  const res = await fetch('http://localhost:8000/api/posts/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ content, media_urls: imageUrls }),
  });
  return res.json();
};
```

Tips

- In development you can use the console email backend to inspect emails (Django settings may default to console or file backend). See `liberty_social/settings.py` for DEFAULT_FROM_EMAIL and email settings.
- If using `django-cors-headers` ensure it's installed in your environment and `CorsMiddleware` is placed near the top of `MIDDLEWARE` (see instructions inline in settings).

Troubleshooting

- If you get CORS errors, confirm the frontend origin (protocol + host + port) is listed in `CORS_ALLOWED_ORIGINS`.
- If uploads fail, verify AWS credentials and bucket name in your `.env`.
- For testing locally without S3, you can stub the upload endpoint to accept files and return a data URL, or configure a local S3-compatible service.

Contact

- If you need help wiring the frontend forms or examples for the routes used by this backend, ask and I'll provide example React components or a small demo app.

Next.js-specific notes
----------------------

This section gives concrete examples and recommendations when building a Next.js frontend (App Router or Pages Router).

Auth & token handling

- The backend uses JWT (Simple JWT). For browser-based apps we recommend storing the access token in memory and the refresh token in an HttpOnly cookie set by the backend (safer), or both tokens in HttpOnly cookies so SSR/server components can read them.
- If you keep tokens in JavaScript (localStorage), be aware of XSS risks. Prefer HttpOnly cookies for production.

Example: client-side fetch with JWT

```js
// simple fetch wrapper
async function apiFetch(path, { method = 'GET', body, token, headers = {} } = {}) {
  const opts = { method, headers: { ...headers } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  } else if (body instanceof FormData) {
    opts.body = body;
  }
  const res = await fetch(`http://localhost:8000${path}`, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

Uploading files from Next.js (client component)

```js
async function uploadImage(file, token) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('http://localhost:8000/api/uploads/images/', {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
    body: fd,
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json(); // { url: 'https://...' }
}

// Then include the returned URLs in a post create call:
// apiFetch('/api/posts/', { method: 'POST', body: { content: 'hi', media_urls: [url1, url2] }, token })
```

Next.js server components / SSR

- If you want to render pages server-side that require the user's identity, prefer storing auth tokens in HttpOnly cookies so server-side code can call the backend using those cookies.
- Example: have a small server endpoint (/api/session/) that exchanges cookies for a user object using the backend token refresh flow.

Resend (email) integration
--------------------------

This backend can send emails through Resend. To enable it:

1. Add `RESEND_API_KEY` to your `.env` (see `.env.template`).
2. The backend will configure a Django email backend that sends using Resend if `RESEND_API_KEY` is present.

What this does:
- Password reset and other email flows will send through Resend when `RESEND_API_KEY` is set.
- For local development you can still use Django's console email backend by leaving `RESEND_API_KEY` empty.

Resend tips

- Get your API key from https://resend.com and set it as `RESEND_API_KEY` in `.env`.
- Make sure `DEFAULT_FROM_EMAIL` is set to the address you want to send from (in `settings.py` or `.env`).

Example `.env` entries:

```
RESEND_API_KEY=re_XXXXXXXXXXXXXXXXXXXXXXXX
DEFAULT_FROM_EMAIL="Acme Social <no-reply@example.com>"
```

If you want I can also provide a small Next.js example that uploads images and creates posts (including a tiny component and a server action to proxy uploads through the backend). Just tell me whether you use the App Router or Pages Router.
