const request = require('supertest');
const app = require('../service');

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

describe('orderRouter', () => {
  let orderAuthToken;

  beforeAll(async () => {
    // Register a normal (non-admin) user
    const orderUser = {
      name: 'order diner',
      email: randomName() + '@test.com',
      password: 'a',
    };

    const registerRes = await request(app)
      .post('/api/auth')
      .send(orderUser);

    orderAuthToken = registerRes.body.token;
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
});
