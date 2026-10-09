# User service

Rails JSON API for account registration, sign-in, and public author profiles. It issues 24-hour HS256 bearer tokens shared with `post_service`, and publishes `user.created` events to Kafka's `user-events` topic for the post service's author-profile projection.

## Run locally

```sh
bundle install
JWT_SECRET='use-the-same-private-value-for-both-services' KAFKA_BROKERS=localhost:9092 bundle exec rails db:prepare
JWT_SECRET='use-the-same-private-value-for-both-services' KAFKA_BROKERS=localhost:9092 bundle exec rails server -p 3001
```

`JWT_SECRET` must be identical in both Rails services. Kafka publishing is skipped with an informational log if `KAFKA_BROKERS` is unset.

## Endpoints

- `POST /users` — register with `{ "user": { "name", "email", "password" } }`; returns a bearer token and safe user profile.
- `POST /login` — sign in with `{ "email", "password" }`.
- `GET /users` and `GET /users/:id` — public profile names and IDs only.
- `GET /up` — health check.
