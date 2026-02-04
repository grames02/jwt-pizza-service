const request = require('supertest');
const app = require('../service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;



beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
});

test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { ...testUser, roles: [{ role: 'diner' }] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
};

test('logout', async () => {
  const logoutRes = await request(app)
    .delete('/api/auth')
    .set('Authorization', `Bearer ${testUserAuthToken}`);
  expect(logoutRes.status).toBe(200);
  expect(logoutRes.body).toEqual({ message: 'logout successful' });
});

test('unauthorized logout', async () => {
  const logoutRes = await request(app).delete('/api/auth');
  expect(logoutRes.status).toBe(401);
  expect(logoutRes.body).toEqual({ message: 'unauthorized' });
});

test('register missing fields', async () => {
  const registerRes = await request(app).post('/api/auth').send({ name: 'a', email: 'b' });
  expect(registerRes.status).toBe(400);
  expect(registerRes.body).toEqual({ message: 'name, email, and password are required' });
});

test('register a new user successfully', async () => {
  const newUser = {
    name: 'new diner',
    email: Math.random().toString(36).substring(2, 12) + '@test.com',
    password: 'secret',
  };
  const res = await request(app).post('/api/auth').send(newUser);
  expect(res.status).toBe(200);
  expect(res.body.user).toMatchObject({
    name: newUser.name,
    email: newUser.email,
    roles: [{ role: 'diner' }],
  });
  expectValidJwt(res.body.token);
});


// ===== Order Router Tests =====

global.fetch = jest.fn();

describe('orderRouter', () => {
  let orderUser;
  let orderAuthToken;

  beforeAll(async () => {
    orderUser = {
      name: 'order diner',
      email: Math.random().toString(36).substring(2, 12) + '@test.com',
      password: 'a',
    };

    const registerRes = await request(app).post('/api/auth').send(orderUser);
    orderAuthToken = registerRes.body.token;
  });

  beforeEach(() => {
    fetch.mockReset();
  });

  test('GET /api/order/menu returns menu', async () => {
    const res = await request(app).get('/api/order/menu');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('PUT /api/order/menu rejects non-admin user', async () => {
    const res = await request(app)
      .put('/api/order/menu')
      .set('Authorization', `Bearer ${orderAuthToken}`)
      .send({
        title: 'Test Pizza',
        description: 'No toppings',
        image: 'pizza.png',
        price: 0.1,
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('unable to add menu item');
  });

  test('GET /api/order returns orders for user', async () => {
    const res = await request(app)
      .get('/api/order')
      .set('Authorization', `Bearer ${orderAuthToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('orders');
    expect(Array.isArray(res.body.orders)).toBe(true);
  });

  test('POST /api/order creates order successfully', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        reportUrl: 'http://fake.url',
        jwt: 'factory-jwt',
      }),
    });

    const res = await request(app)
      .post('/api/order')
      .set('Authorization', `Bearer ${orderAuthToken}`)
      .send({
        franchiseId: 1,
        storeId: 1,
        items: [{ menuId: 1, description: 'Veggie', price: 0.05 }],
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('order');
    expect(res.body).toHaveProperty('jwt', 'factory-jwt');
  });

  test('POST /api/order handles factory failure', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        reportUrl: 'http://fail.url',
      }),
    });

    const res = await request(app)
      .post('/api/order')
      .set('Authorization', `Bearer ${orderAuthToken}`)
      .send({
        franchiseId: 1,
        storeId: 1,
        items: [{ menuId: 1, description: 'Veggie', price: 0.05 }],
      });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Failed to fulfill order at factory');
  });
});

// ===== Franchise Router Tests (Simple & Safe) =====

describe('franchise router', () => {
  let adminToken;
  let userToken;
  let franchiseId;
  let storeId;

  beforeAll(async () => {
    // Login as seeded admin
    const adminRes = await request(app)
      .put('/api/auth')
      .send({ email: 'admin@jwt.com', password: 'admin' });

    adminToken = adminRes.body.token;

    // Register a normal user
    const userRes = await request(app)
      .post('/api/auth')
      .send({
        name: 'regular user',
        email: Math.random().toString(36).substring(2, 12) + '@test.com',
        password: 'a',
      });

    userToken = userRes.body.token;
  });

  test('GET /api/franchise returns franchises (public)', async () => {
    const res = await request(app).get('/api/franchise');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('franchises');
    expect(Array.isArray(res.body.franchises)).toBe(true);
    expect(res.body).toHaveProperty('more');
  });

  test('non-admin cannot create a franchise', async () => {
    const res = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'illegal franchise',
        admins: [],
      });

    expect(res.status).toBe(403);
  });

  test('non-admin cannot delete a store', async () => {
    const res = await request(app)
      .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });

  test('franchise can be deleted without authentication', async () => {
  const res = await request(app)
    .delete(`/api/franchise/${franchiseId}`);

  expect(res.status).toBe(200);
  expect(res.body.message).toBe('franchise deleted');
});

test('admin can create a franchise', async () => {
  // Ensure admin is logged in in DB
  const adminUser = await DB.getUser('admin@jwt.com');
  await DB.loginUser(adminUser.id, adminToken);

  const res = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'test franchise',
      admins: [{ email: 'admin@jwt.com' }],
    });

  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('id');

  franchiseId = res.body.id;
});

test('admin can create a store', async () => {
  // Ensure admin is logged in in DB
  const adminUser = await DB.getUser('admin@jwt.com');
  await DB.loginUser(adminUser.id, adminToken);

  const res = await request(app)
    .post(`/api/franchise/${franchiseId}/store`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'SLC' });

  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('id');

  storeId = res.body.id;
});

test('admin can delete a store', async () => {
  // Ensure admin is logged in in DB
  const adminUser = await DB.getUser('admin@jwt.com');
  await DB.loginUser(adminUser.id, adminToken);

  const res = await request(app)
    .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
    .set('Authorization', `Bearer ${adminToken}`);

  expect(res.status).toBe(200);
  expect(res.body.message).toBe('store deleted');
});



});


// ===== User Router Tests =====

describe('user router', () => {
  let userToken;
  let userId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth')
      .send({
        name: 'user test',
        email: Math.random().toString(36).substring(2, 12) + '@test.com',
        password: 'a',
      });

    userToken = res.body.token;
    userId = res.body.user.id;
  });

  test('GET /api/user/me returns authenticated user', async () => {
    const res = await request(app)
      .get('/api/user/me')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', userId);
    expect(res.body).toHaveProperty('email');
    expect(res.body).toHaveProperty('roles');
  });

  test('user can update their own profile', async () => {
    const res = await request(app)
      .put(`/api/user/${userId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'updated name',
        email: 'updated@test.com',
        password: 'newpass',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.name).toBe('updated name');
    expect(res.body).toHaveProperty('token');
  });

  test('non-admin cannot update another user', async () => {
    const res = await request(app)
      .put('/api/user/9999')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'hacker',
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('unauthorized');
  });

  test('GET /api/user/ returns not implemented', async () => {
    const res = await request(app)
      .get('/api/user/')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'not implemented', users: [], more: false });
  });

  test('DELETE /api/user/:userId returns not implemented', async () => {
    const res = await request(app)
      .delete(`/api/user/${userToken}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'not implemented' });
  });
});
