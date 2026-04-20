# User Auth API

A simple Node.js auth backend that stores users in `users.json`, hashes passwords, and issues JWT tokens.

## Run

1. Install Node.js if needed.
2. Install dependencies:

```bash
npm install
```

3. Start the server:

```bash
npm start
```

## Endpoints

- `POST /register`
  - Body: `{ "email": "user@example.com", "password": "secret", "name": "Test User" }`
  - Returns `201 Created` when registration succeeds
  - Returns `409 Conflict` if the email already exists

- `POST /login`
  - Body: `{ "email": "user@example.com", "password": "secret" }`
  - Returns `200 OK` with a JWT token on success

- `GET /me`
  - Header: `Authorization: Bearer <token>`
  - Returns the authenticated user's profile

- `GET /health`
  - Returns status check

- `GET /users`
  - Returns stored users without password data (for testing)

- `GET /frontend.html`
  - Open the local file `frontend.html` in your browser to use the sample UI

## Storage

- `users.json` stores registered user data in JSON format.
- Passwords are stored as hashes using `bcrypt`.
