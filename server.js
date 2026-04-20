const http = require('http');
const fs = require('fs').promises;
const path = require('path');

const PORT = process.env.PORT || 3000;
const STORE_PATH = path.resolve(__dirname, 'users.json');

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

function buildUserRecord(body) {
  const now = new Date().toISOString();
  const email = normalizeEmail(body.email);
  const { password, name, ...extraFields } = body;

  return {
    id: Date.now(),
    email,
    password,
    name: name || null,
    createdAt: now,
    lastLogin: now,
    ...extraFields,
  };
}

async function handleAuth(req, res) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    sendJSON(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  const email = normalizeEmail(body.email);
  const password = body.password;
  const name = body.name;
  const extraFields = { ...body };
  delete extraFields.email;
  delete extraFields.password;
  delete extraFields.name;
  delete extraFields.register;

  if (!email || !password) {
    sendJSON(res, 400, { error: 'email and password are required' });
    return;
  }

  const users = await loadUsers();
  const existing = users.find((u) => u.email === email);

  if (existing) {
    sendJSON(res, 409, { error: 'Duplicate request received. User already registered.' });
    return;
  }

  const newUser = buildUserRecord({ email, password, name, ...extraFields });
  users.push(newUser);
  await saveUsers(users);

  sendJSON(res, 201, {
    message: 'User registered and authenticated',
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      createdAt: newUser.createdAt,
      lastLogin: newUser.lastLogin,
    },
  });
}

async function handleUsers(req, res) {
  const users = await loadUsers();
  sendJSON(res, 200, { users: users.map(({ password, ...rest }) => rest) });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/auth') {
    await handleAuth(req, res);
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
  console.log(`Test auth endpoint running at http://localhost:${PORT}`);
});
