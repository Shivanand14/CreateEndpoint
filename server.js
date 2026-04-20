const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 3000;
const STORE_PATH = path.resolve(__dirname, 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'replace-this-secret';
const JWT_EXPIRES_IN = '1h';

async function loadUsers() {
  try {
    const text = await fs.readFile(STORE_PATH, 'utf8');
    return text ? JSON.parse(text) : [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function saveUsers(users) {
  await fs.writeFile(STORE_PATH, JSON.stringify(users, null, 2), 'utf8');
}

function sendJSON(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body, 'utf8'),
  });
  res.end(body);
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function stripSensitiveUserData(user) {
  const { password, passwordHash, ...profile } = user;
  return profile;
}

function parseBearerToken(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }
  const [scheme, token] = authHeader.split(' ');
  return scheme === 'Bearer' ? token : null;
}

async function parseJSONBody(req, res) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    sendJSON(res, 400, { error: 'Invalid JSON body' });
    return null;
  }
}

async function createPasswordHash(password) {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(storedUser, password) {
  if (storedUser.passwordHash) {
    return bcrypt.compare(password, storedUser.passwordHash);
  }

  if (storedUser.password) {
    return storedUser.password === password;
  }

  return false;
}

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

async function handleRegister(req, res) {
  const body = await parseJSONBody(req, res);
  if (!body) return;

  const email = normalizeEmail(body.email);
  const password = body.password;
  const name = body.name || null;

  if (!email || !password) {
    sendJSON(res, 400, { error: 'email and password are required' });
    return;
  }

  const users = await loadUsers();
  const existing = users.find((u) => u.email === email);
  if (existing) {
    sendJSON(res, 409, { error: 'duplicate request received. user already registered.' });
    return;
  }

  const passwordHash = await createPasswordHash(password);
  const now = new Date().toISOString();
  const newUser = {
    id: Date.now(),
    email,
    passwordHash,
    name,
    createdAt: now,
    updatedAt: now,
  };

  users.push(newUser);
  await saveUsers(users);

  sendJSON(res, 201, {
    message: 'User registered successfully',
    user: stripSensitiveUserData(newUser),
  });
}

async function handleLogin(req, res) {
  const body = await parseJSONBody(req, res);
  if (!body) return;

  const email = normalizeEmail(body.email);
  const password = body.password;

  if (!email || !password) {
    sendJSON(res, 400, { error: 'email and password are required' });
    return;
  }

  const users = await loadUsers();
  const user = users.find((u) => u.email === email);
  if (!user) {
    sendJSON(res, 401, { error: 'invalid credentials' });
    return;
  }

  const isValid = await verifyPassword(user, password);
  if (!isValid) {
    sendJSON(res, 401, { error: 'invalid credentials' });
    return;
  }

  if (!user.passwordHash && user.password) {
    user.passwordHash = await createPasswordHash(password);
    delete user.password;
    user.updatedAt = new Date().toISOString();
    await saveUsers(users);
  }

  const token = signToken(user);
  sendJSON(res, 200, {
    message: 'User logged in successfully',
    token,
  });
}

async function handleMe(req, res) {
  const token = parseBearerToken(req);
  if (!token) {
    sendJSON(res, 401, { error: 'Authorization token required' });
    return;
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    sendJSON(res, 401, { error: 'Invalid or expired token' });
    return;
  }

  const users = await loadUsers();
  const user = users.find((u) => u.id === payload.id && u.email === payload.email);
  if (!user) {
    sendJSON(res, 401, { error: 'User not found' });
    return;
  }

  sendJSON(res, 200, { user: stripSensitiveUserData(user) });
}

async function handleUsers(req, res) {
  const users = await loadUsers();
  sendJSON(res, 200, { users: users.map(stripSensitiveUserData) });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && (req.url === '/register' || req.url === '/auth')) {
    await handleRegister(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/login') {
    await handleLogin(req, res);
    return;
  }

  if (req.method === 'GET' && req.url === '/me') {
    await handleMe(req, res);
    return;
  }

  if (req.method === 'GET' && req.url === '/users') {
    await handleUsers(req, res);
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJSON(res, 200, { status: 'ok' });
    return;
  }

  sendJSON(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Auth API running at http://localhost:${PORT}`);
});
