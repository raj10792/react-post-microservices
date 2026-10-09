# Copilot instructions

## Project overview

Daybook is a React social-post and comment app backed by two independent Rails JSON services:

- `frontend/`: React client, built into static files and served by Nginx.
- `user_service/`: account registration, login, public profiles, and JWT issuance.
- `post_service/`: posts, comments, feed responses, and a local author-profile projection.
- `docker-compose.yml`: local orchestration for the frontend, Rails services, Kafka, and the event consumer.

Each Rails service owns its own database. Do not couple them by reading or writing each other's database.

## Architecture and API conventions

- Keep user/account responsibilities in `user_service` and post/comment responsibilities in `post_service`.
- Rails controllers return JSON. Add or update routes in the owning service's `config/routes.rb`.
- Public feed and public profile reads do not require authentication. Creating or deleting posts and comments requires a bearer token.
- The user service issues HS256 JWTs through `JsonWebToken`; both services must use the same `JWT_SECRET`. Derive write authorship from the verified token, never from a client-supplied `user_id`.
- Return only safe public profile fields. Never serialize password digests, authentication tokens, or other private account data into public responses.
- Keep the services decoupled. Communicate cross-service changes through Kafka domain events rather than synchronous access to another service's database.
- Publish user events to `user-events`; publish post and comment events to `post-events`. The post-service consumer currently projects `user.created` events into its local `author_profiles` table. Keep event payloads explicit, include a unique event ID and occurrence timestamp, and make consumers safe to replay where practical.
- Kafka publishing currently occurs synchronously after the database write and is not backed by a transactional outbox. Do not assume database writes and Kafka delivery are atomic.
- When changing API paths or response shapes, update the React client, the relevant Rails service, `frontend/nginx.conf`, and documentation together.
- In Docker, the browser uses `/api/users` and `/api/posts`; Nginx strips those prefixes and proxies to the Rails containers. For local React development, the API clients default to ports `3001` and `3002`.

## Frontend conventions

- Keep the UI in React and follow the existing `App.js`, `App.css`, and `index.css` structure unless a change warrants a small, focused component extraction.
- Use the configured Axios clients for API requests. Surface request errors in the UI; do not silently turn API failures into successful empty results.
- Treat authentication as client state only for presentation. The Rails APIs remain responsible for verifying tokens and authorizing writes.
- Store browser-only preferences such as saved post IDs in `localStorage`; do not imply that these preferences are synchronized to the server.
- Preserve accessible labels, keyboard focus, responsive layouts, and reduced-motion support.

## Validation

Run checks from the directory that owns the application:

```sh
cd frontend && npm run build && npm test -- --watchAll=false --runInBand
cd user_service && bundle exec rubocop <changed Ruby files> && bundle exec rails zeitwerk:check
cd post_service && bundle exec rubocop <changed Ruby files> && bundle exec rails zeitwerk:check
docker compose config --quiet
```

For changes spanning services, use `docker compose up --build --wait` and verify the affected API flow through the frontend proxy when Docker is available. Database schema changes belong in Rails migrations, not manual edits to the schema file.

## Security and local development

- Use the same private `JWT_SECRET` for both Rails services outside local development. Replace the development defaults for `JWT_SECRET` and `SECRET_KEY_BASE` before deploying.
- Do not commit secrets, credentials, database files, build output, or dependency directories.
- Docker Compose uses Kafka's internal address `kafka:9092`; host-side tools use the published port `localhost:9092`.
- Update the root and service READMEs when setup instructions or externally relevant behavior changes.
