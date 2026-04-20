# Test Auth Endpoint

A simple test HTTP server for authenticating a user and storing user data in `users.json`.

## Run

1. Install Node.js if needed.
2. Start the server:

```bash
node server.js
```

## Endpoints

- `POST /auth`
  - Body: `{ "email": "user@example.com", "password": "secret", "name": "Test User" }`
  - If user does not exist: creates and authenticates the user
  - If user exists: validates password and updates last login

- `GET /users`
  - Returns stored users without passwords

- `GET /health`
  - Returns status check

## Storage

- `users.json` stores registered user data in JSON format.
