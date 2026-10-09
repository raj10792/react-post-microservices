# Daybook

A small social feed for sharing posts and talking in the comments. The React client is backed by two independent Rails JSON APIs: `user_service` owns registration and authentication, while `post_service` owns posts and comments. The services publish domain events to Kafka; a post-service consumer projects new user profiles locally so feed authors can be displayed without synchronous cross-service requests.

## Run the full stack

Requirements: Docker Engine and Docker Compose.

```sh
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). The APIs are also available at `http://localhost:3001` (users) and `http://localhost:3002` (posts). Compose persists each service's SQLite database and Kafka data in named volumes.

The Compose file includes development-only defaults for `JWT_SECRET` and `SECRET_KEY_BASE`. Set both to private, strong values in the environment before using this setup anywhere beyond a local machine. Kafka is available to host tools at port `9092` and to the services at `kafka:9092`.

## Features

- Browse, search, and bookmark the most recent 50 community posts.
- Create an account or log in, publish posts, and reply to posts.
- Delete your own posts; post and comment authorship comes from the signed-in identity, not request parameters.
- Profile creation events are published to `user-events` and consumed by the post service to maintain its author projection. Post and comment lifecycle events are published to `post-events`.
- Rails health endpoints are exposed at `/up` on both APIs.

## Run services without Docker

Install Ruby 4.0.5 and Node.js 22, then run each Rails service in its own terminal. Start a Kafka broker first if event delivery is needed.

```sh
cd user_service
bundle install
JWT_SECRET='use-the-same-private-value-for-both-services' KAFKA_BROKERS=localhost:9092 bundle exec rails db:prepare
JWT_SECRET='use-the-same-private-value-for-both-services' KAFKA_BROKERS=localhost:9092 bundle exec rails server -p 3001
```

```sh
cd post_service
bundle install
JWT_SECRET='use-the-same-private-value-for-both-services' KAFKA_BROKERS=localhost:9092 bundle exec rails db:prepare
JWT_SECRET='use-the-same-private-value-for-both-services' KAFKA_BROKERS=localhost:9092 bundle exec rails server -p 3002
```

In another terminal, run `cd post_service && KAFKA_BROKERS=localhost:9092 bundle exec rails events:consume` to consume profile events. Start the React development server with `cd frontend && npm ci && npm start`; its default API URLs point to ports 3001 and 3002.
