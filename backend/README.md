Liberty Social backend API

This repository contains the backend API for the Liberty Social project (Django + Django REST Framework).

Quick start

1. Create and activate a virtual environment (Windows PowerShell):

```powershell
python -m venv venv; .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Authentication

- This project uses JWT access/refresh tokens via `djangorestframework-simplejwt`.
- After registering or logging in, you will receive `access_token` and `refresh_token`. Use the `Authorization: Bearer <access_token>` header for protected endpoints.

Primary endpoints

Base URL: http://localhost:8000/api/auth/

- POST /register/  — Register a new user
  - Request body (JSON): { "email": "alice@example.com", "password": "secret", "first_name": "Alice", "last_name": "Example", "username": "alice" }
  - Response (201): { "user_id": "<uuid>", "refresh_token": "<token>", "access_token": "<token>" }

- POST /login/ — Login
  - Request body: { "username": "alice@example.com", "password": "secret" }
  - Response (200): { "refresh_token": "<token>", "access_token": "<token>", "user_id": "<uuid>" }

- POST /logout/ — Logout (blacklist refresh token)
  - Request body: { "refresh_token": "<refresh_token>" }

User profiles

- GET /user/ — Returns the authenticated user's profile
- GET /user/{id}/ — Retrieve another user's profile (subject to privacy settings and block status)

Friend requests

- GET /friend-requests/?direction=incoming|outgoing — List friend requests
- POST /friend-requests/ — Send a friend request
  - Request body: { "to_user": "<user-uuid>" }
  - Response (201): { "id": 1, "from_user": { ... }, "to_user": "<uuid>", "status": "pending", "created_at": "..." }
- POST /friend-requests/{id}/accept-friend-request/ — Accept a friend request (creates reciprocal friendship)
- POST /friend-requests/{id}/decline/ — Decline (marks request as declined)
- POST /friend-requests/{id}/cancel/ — Cancel your outgoing request (deletes it)

Friends

- GET /friends/ — List your friends
- POST /friends/ — (not recommended) Directly create a friendship (the serializer will create reciprocal rows)
- DELETE /friends/{id}/ — Remove a friend (deletes reciprocal rows)

Blocks

- POST /blocks/ — Block a user
  - Request body: { "blocked_user": "<user-uuid>" }
  - Blocking removes any existing friendship and cancels pending friend requests between the users
- DELETE /blocks/{id}/ — Unblock a user (only the owner who created the block may unblock)

OpenAPI / API docs

- Schema (OpenAPI JSON): GET /api/schema/
- Swagger UI: GET /api/schema/swagger-ui/
- Redoc UI: GET /api/schema/redoc/

Sample request (send friend request)

POST /api/auth/friend-requests/
Headers:
  Authorization: Bearer <access_token>
Body:
{
  "to_user": "d4daaf88-1db9-4433-85a2-1bb00bc4fa4b"
}

Sample response (201):
{
  "id": 12,
  "from_user": {
    "id": "...",
    "email": "alice@example.com",
    "first_name": "Alice",
    "last_name": "Example",
    "username": "alice"
  },
  "to_user": "d4daaf88-1db9-4433-85a2-1bb00bc4fa4b",
  "status": "pending",
  "created_at": "2025-10-30T12:34:56Z"
}

Notes & next steps

- The project includes basic privacy enforcement and block handling. Consider adding notifications, rate-limiting for friend requests, pagination, and more comprehensive tests for production readiness.
- Before running migrations on a production DB, backup your database. The migration converting raw UUID relationship fields into proper ForeignKeys includes a data backfill step and should be reviewed on a staging copy first.

Reaction model migration (important)

- The `Reaction` model was converted from a simple ForeignKey to `Post` into a generic relation (ContentType + object_id) so reactions can target multiple object types (posts, comments, etc.).
- Migration steps applied in this repository:
  1. `main/migrations/0002_reaction_generic.py` — Adds `content_type` and `object_id` fields, backfills existing reactions (if any) to reference `Post`, and makes the old `post` FK nullable to avoid NOT NULL constraints during transition. The migration is defensive: it creates the required ContentType entry if missing.
  2. `main/migrations/0003_remove_post_and_finalize_reaction.py` — Finalizes the unique constraint to `(content_type, object_id, user)` and removes the legacy `post` column.

- Why this matters: data migrations that touch ContentType rows can fail during test DB creation or on fresh installs if the contenttypes entries are not present yet. The migrations here use the migrations-safe `apps.get_model('contenttypes', 'ContentType')` API and defensively create the ContentType row when necessary.

- Recommended deployment procedure for production databases:
  1. Create a full database backup.
 2. Run migrations in a staging environment that mirrors production, and validate application behavior (especially any code paths that write Reactions).
 3. Deploy application code that expects the new generic `Reaction` fields (ensure code is compatible with both the old and new schema if you do a phased rollout).
 4. Run the migrations on production during a maintenance window.

Running tests

- Run the test suite locally (this will create a test database and apply migrations):

```powershell
python manage.py test --verbosity=2
```

This repository's tests exercise user flows (friend requests, blocks, privacy) and the `main` app features (posts, comments, reactions). All tests should pass after migrations apply.

License

This project is provided under the MIT license (or adapt as appropriate).
