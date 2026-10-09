# Daybook project guide

This guide explains how to follow a request through the app, then goes deeper into how Kafka and Nginx connect the services.

## 1. Project at a glance

Daybook has a React frontend, two independent Rails JSON services, Kafka, and an Nginx web server in the frontend container.

| Component | Responsibility |
| --- | --- |
| `frontend/` | React screens, browser state, and requests to the APIs. |
| `frontend/nginx.conf` | Serves the built React app and routes API requests to the right Rails service. |
| `user_service/` | User registration, login, public user profiles, and JWT creation. |
| `post_service/` | Posts, comments, feed responses, and a local copy of author names. |
| Kafka | Carries events between services without sharing their databases. |
| `event-consumer` | A separate post-service process that listens for user events and updates author names. |
| `docker-compose.yml` | Starts the frontend, services, Kafka, and consumer on one Docker network. |

The two Rails services own separate SQLite databases. The post service does not query the user service's database.

```text
Browser
  │ HTTP :3000
  ▼
Nginx + built React app
  ├── /api/users/... ──► user-service:80
  └── /api/posts/... ──► post-service:80

user-service ── user-events ──► Kafka ──► event-consumer
                                              │
                                              ▼
                                     post-service database
                                      author_profiles table

post-service ── post-events ──► Kafka
```

## 2. Follow the app from startup to the feed

1. `docker compose up --build` builds the React assets, builds the Rails images, and starts Kafka and both APIs.
2. Compose places the containers on a private network. Within that network, services discover one another by Compose service name, for example `post-service` and `kafka`.
3. Nginx serves the React files on port `3000`.
4. React starts at `frontend/src/index.js`, renders `frontend/src/App.js`, and loads the feed with `GET /posts`.
5. In Docker, the post API client's base URL is `/api/posts`, so the request goes to `/api/posts/posts` on the frontend origin.
6. Nginx forwards that request to the post service, which returns up to 50 recent posts and their comments.
7. `PostsController` adds an author name from the local `author_profiles` table when one is available.
8. React shows the posts, loading or empty state, or an error if the API request fails.

To run the React development server outside Docker, use `cd frontend && npm start`. Its default API URLs are `http://localhost:3001` for users and `http://localhost:3002` for posts, so development requests bypass Nginx.

## 3. Sign-up, login, and authenticated writes

### Sign-up

1. React submits the name, email, and password to `POST /users`.
2. `user_service/config/routes.rb` maps that route to `UsersController#create`.
3. The user model validates the account and Rails secure-password support stores a password digest instead of the original password.
4. `JsonWebToken` signs a token containing the user ID and expiration time.
5. The response includes the token and safe public user details. React stores this session in browser `localStorage`.
6. The user service also publishes a `user.created` Kafka event, described in the Kafka section below.

### Login

1. React sends email and password to `POST /login`.
2. `SessionsController#create` looks up the user and checks the submitted password against the stored digest.
3. On success, it returns a fresh token and the public user details. Invalid credentials return `401 Unauthorized`.

### Creating a post or comment

1. React sends its token as `Authorization: Bearer <token>`.
2. The post service's `ApplicationController` verifies the token using `JWT_SECRET`.
3. The controller derives the author ID from the verified token, not from the submitted JSON.
4. The service validates and saves the post or comment, then returns it to React.

Writes require a valid token. Public feed and public profile reads do not. Post and comment deletions check that the authenticated user owns the record.

## 4. Kafka in depth

### What Kafka does here

Kafka is a durable, append-only event log organized into named **topics**. A producer writes a message to a topic; a consumer subscribes and reads it later. This lets the producing service report what happened without calling the consuming service directly or accessing its database.

Kafka is not the database for Daybook's posts or users. Those remain in their owning Rails services. Kafka carries facts about changes so other services can react to them.

### User creation event: end-to-end

1. `UsersController#create` saves the user in the user service's database.
2. After the save succeeds, it calls `EventPublisher.publish("user.created", user_id: ..., name: ...)`.
3. `user_service/app/services/event_publisher.rb` constructs a JSON message containing:
   - `event_id`: a unique ID for this event.
   - `event_type`: `user.created`.
   - `occurred_at`: the event timestamp.
   - `data`: the user ID and display name.
4. The publisher writes the message to Kafka topic `user-events`, using the user ID as the Kafka message key.
5. The `event-consumer` Compose service runs the Rake task in `post_service/lib/tasks/events.rake`.
6. The task subscribes to `user-events` as consumer group `post-service`.
7. When it receives a `user.created` message, it upserts the ID and name into `author_profiles` in the post service's database.
8. When the feed is next serialized, `PostsController` reads that local profile and includes the author's name.

This creates **eventual consistency**. The signup response does not wait for the post service's profile projection to update, so a just-created author may temporarily appear as “New member”.

### Topics and message keys

- `user-events` contains user lifecycle events. It is the topic consumed by the profile projection.
- `post-events` receives post and comment lifecycle events. There is not currently a consumer for this topic in the app.
- User events use the user ID as the Kafka key. Post events use the post ID when available, otherwise the user ID.

A Kafka topic is divided into partitions; this Compose setup configures three partitions. A key determines the partition, so events with the same key are routed together. Within a partition, Kafka maintains message order. Ordering is not global across every partition.

### Consumer groups and replay

The `post-service` consumer group gives Kafka a place to track the consumer's progress. On normal restarts, a group resumes from its committed offsets. The task subscribes with `start_from_beginning: true`, which starts at the earliest available messages when there is no saved position yet; it does not mean that every restart necessarily replays the entire topic.

`AuthorProfile.upsert` makes processing a repeated `user.created` event safe for the profile row: it inserts the user if missing or updates the existing profile. This is a simple form of idempotency.

### Kafka configuration in Docker Compose

The `kafka` service uses the Apache Kafka image in **KRaft** mode. KRaft means the broker also runs the controller role; this single-node development setup does not need a separate ZooKeeper service.

Important settings in `docker-compose.yml`:

- `KAFKA_PROCESS_ROLES: broker,controller` runs both Kafka roles in one container.
- `KAFKA_LISTENERS` configures a client listener on `9092` and controller listener on `9093`.
- `KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092` tells Docker-network clients which broker hostname to use.
- `KAFKA_CONTROLLER_QUORUM_VOTERS` identifies the single KRaft controller.
- Replication factor `1` is appropriate only for a local, single-broker setup.
- `kafka_data_v39` is a named volume so broker data survives container recreation.
- The health check waits until Kafka accepts a topic-list request before dependent services start.

Rails containers use `KAFKA_BROKERS=kafka:9092`. Docker DNS resolves `kafka` to the Kafka container. A tool running on the host machine can use the published port `localhost:9092`, but its ability to connect depends on the broker's advertised listener configuration.

### Reliability limits to understand

- Kafka publishing happens **after** the Rails database write and currently runs during the request. There is no transactional outbox. The database save and Kafka publish are not one atomic operation: Kafka could fail after the record is saved, causing a request error even though the record exists.
- Event publishing is not retried by an outbox or background publisher. Production systems commonly persist an outbox event in the same database transaction as the domain write, then publish and retry from the outbox.
- The consumer uses a `user.created` upsert, but this is not a complete general-purpose event-processing framework. Adding consumers for more event types should consider idempotency, validation, error handling, retries, and dead-letter handling.
- One plaintext broker with replication factor `1` provides no broker redundancy and no encrypted/authenticated connection. It is for local learning, not production.
- If `KAFKA_BROKERS` is missing, the event publisher logs that the event was skipped. The user or post database write can still succeed.

### Useful Kafka commands

Follow profile-consumer logs:

```sh
docker compose logs -f event-consumer
```

List topics from the broker container:

```sh
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 --list
```

Describe partitions and topic configuration:

```sh
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 --describe --topic user-events
```

## 5. Nginx in depth

### What Nginx does here

Nginx runs in the **frontend container**. The frontend Dockerfile first builds React into static HTML, JavaScript, and CSS, then copies those files into an Nginx image. Nginx has two jobs:

1. Serve the built React app to the browser.
2. Act as a reverse proxy for requests to the two Rails APIs.

The browser normally talks to Nginx at `http://localhost:3000`. It does not need to know the Docker-only hostnames `user-service` and `post-service`.

### How the `/api/posts/` proxy works

The relevant block in `frontend/nginx.conf` is:

```nginx
location /api/posts/ {
  proxy_pass http://post-service:80/;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

Suppose React requests:

```text
http://localhost:3000/api/posts/posts
```

1. Nginx matches the `/api/posts/` location.
2. It resolves `post-service` using Docker Compose's internal DNS.
3. Because the `proxy_pass` URL has a trailing slash after the port, Nginx replaces the matched `/api/posts/` prefix with `/`.
4. The upstream Rails request becomes `http://post-service:80/posts`.
5. Rails routes `/posts` to `PostsController#index`.
6. Rails returns JSON through Nginx to the browser.

Similarly, a browser request for `/api/users/users` is forwarded to the user service as `/users`.

The trailing slash matters. With this `location /api/posts/` and `proxy_pass http://post-service:80/`, the matching prefix is replaced. Changing the `proxy_pass` URI or removing its trailing slash can change the upstream path and break Rails routing.

### Forwarded headers

- `Host` passes the browser's original host value upstream.
- `X-Forwarded-For` records the requesting client IP as requests pass through proxies.
- `X-Forwarded-Proto` records the original request scheme, such as `http` or `https`.

These headers are useful for application logs and URL generation behind a proxy. The Rails app should only trust forwarded headers from proxies it controls.

### Serving React and supporting frontend routes

The final Nginx location is:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

Nginx first looks for a matching static file or directory. If none exists, it serves `index.html`, and React takes over routing in the browser. This fallback is important if the frontend later adds client-side routes: refreshing one of those routes should still load the React app instead of returning a server-side 404.

### Same-origin behavior and CORS

In Docker, pages and API requests use the same browser origin, `http://localhost:3000`. The API calls are relative paths and Nginx forwards them server-to-server. The browser therefore does not make a cross-origin request to ports 3001 or 3002.

In local development, React's default API URLs point directly to `http://localhost:3001` and `http://localhost:3002`. Those are different origins from the React development server at port `3000`, so the Rails `rack-cors` configuration allows that origin.

The Nginx proxy is not an authorization layer. It routes traffic; the Rails services still validate JWTs and enforce ownership on protected operations.

### Useful Nginx checks

Check the frontend container logs:

```sh
docker compose logs -f frontend
```

Check that the frontend and proxied feed return responses:

```sh
curl -i http://localhost:3000/
curl -i http://localhost:3000/api/posts/posts
curl -i http://localhost:3000/api/users/up
```

If the page loads but API requests fail, check that the Rails containers are healthy and inspect the proxy paths. If React returns a development-only API URL in a Docker build, rebuild the frontend image so its `REACT_APP_*` build arguments are applied.

## 6. Where to read the code

For a learning walkthrough, follow these files in order:

1. `frontend/src/index.js` — React entry point.
2. `frontend/src/App.js` — UI state and API calls.
3. `frontend/Dockerfile` — React build and Nginx runtime image.
4. `frontend/nginx.conf` — static file serving and API proxy routes.
5. `user_service/config/routes.rb` — registration, profiles, and login routes.
6. `user_service/app/controllers/users_controller.rb` and `sessions_controller.rb` — registration and login.
7. `user_service/app/services/json_web_token.rb` — JWT creation and verification.
8. `user_service/app/services/event_publisher.rb` — user event producer.
9. `post_service/config/routes.rb` — post and comment routes.
10. `post_service/app/controllers/posts_controller.rb` and `comments_controller.rb` — feed, comments, and ownership checks.
11. `post_service/app/services/event_publisher.rb` — post/comment event producer.
12. `post_service/lib/tasks/events.rake` — Kafka consumer and profile projection.
13. `post_service/app/models/author_profile.rb` and `post_service/db/migrate/` — local author projection schema.
14. `docker-compose.yml` — networking, startup dependencies, volumes, health checks, and Kafka settings.

## 7. Run and validate

Start the complete stack:

```sh
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). The APIs are also published on host ports `3001` and `3002`; Kafka is published on `9092`.

Check service health:

```sh
docker compose ps
curl -i http://localhost:3001/up
curl -i http://localhost:3002/up
```

Stop the containers without deleting named volumes:

```sh
docker compose down
```

Use private `JWT_SECRET` and `SECRET_KEY_BASE` environment values before deploying anywhere beyond local development. Never commit real secrets.
