# Post service

Rails JSON API for the community feed and nested comments. Writes require an HS256 bearer token issued by `user_service`; the service derives authorship from the token rather than trusting a request's `user_id`.

## Run locally

```sh
bundle install
JWT_SECRET='use-the-same-private-value-for-both-services' KAFKA_BROKERS=localhost:9092 bundle exec rails db:prepare
JWT_SECRET='use-the-same-private-value-for-both-services' KAFKA_BROKERS=localhost:9092 bundle exec rails server -p 3002
```

Start the Kafka profile consumer in another terminal:

```sh
KAFKA_BROKERS=localhost:9092 bundle exec rails events:consume
```

`JWT_SECRET` must be identical in both Rails services. If `KAFKA_BROKERS` is unset, event publishing is skipped with an informational log.

## Endpoints

- `GET /posts` and `GET /posts/:id` — public feed and post details, including replies.
- `POST /posts` — create a post using `{ "post": { "title", "content" } }`.
- `DELETE /posts/:id` — delete your own post.
- `GET /posts/:post_id/comments` — list replies.
- `POST /posts/:post_id/comments` — add a reply using `{ "comment": { "content" } }`.
- `DELETE /posts/:post_id/comments/:id` — delete your own reply.
- `GET /up` — health check.

User profile creation events are consumed from `user-events` and stored locally in `author_profiles`; post and comment lifecycle events are published to `post-events`.
