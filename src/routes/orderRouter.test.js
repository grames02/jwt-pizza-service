global.fetch = jest.fn();

const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

// Helper to create an admin user in DB
async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  user = await DB.addUser(user);
  return { ...user, password: 'toomanysecrets' };
}

describe('orderRouter', () => {
  let orderUser;
  let orderAuthToken;
  let adminUser;
  let adminToken;
  let franchiseId;
  let storeId;

  beforeAll(async () => {
    // Create and login admin user
    adminUser = await createAdminUser();
    const adminRes = await request(app)
      .put('/api/auth')
      .send({ email: adminUser.email, password: adminUser.password });
    adminToken = adminRes.body.token;

    // Create a franchise
    const franchiseRes = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Franchise ${randomName()}`,
        admins: [{ email: adminUser.email }],
      });
    franchiseId = franchiseRes.body.id;

    // Create a store
    const storeRes = await request(app)
      .post(`/api/franchise/${franchiseId}/store`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Store ${randomName()}` });
    storeId = storeRes.body.id;

    // Register a normal user to place orders
    orderUser = {
      name: 'order diner',
      email: randomName() + '@test.com',
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
        franchiseId,
        storeId,
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
        franchiseId,
        storeId,
        items: [{ menuId: 1, description: 'Veggie', price: 0.05 }],
      });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Failed to fulfill order at factory');
  });
});
