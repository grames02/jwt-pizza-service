const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
const menuItem = { title: `${randomName()}`, description: `${randomName()}`, image: `${randomName()}`, price: 9.99 };

let testUserAuthToken;
let adminUser;

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  user = await DB.addUser(user);
  return { ...user, password: 'toomanysecrets' };
}


beforeAll(async () => {
    adminUser = await createAdminUser();
    const adminRes = await request(app).put('/api/auth').send({ email: adminUser.email, password: adminUser.password });
    adminUser.token = adminRes.body.token;
    expectValidJwt(adminUser.token);

    testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = registerRes.body.token;
    expectValidJwt(testUserAuthToken);
    testUser.token = testUserAuthToken;
});

test('getMenu', async () => {
  const res = await request(app)
    .get('/api/order/menu')
    .set('Authorization', `Bearer ${testUserAuthToken}`);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

test('createOrder', async () => {
  const res = await request(app)
    .post('/api/order')
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .send({
      items: [{ id: menuItem.id, quantity: 1 }],
    });
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('id');
});

test('getOrder', async () => {
  const createRes = await request(app)
    .post('/api/order')
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .send({
      items: [{ id: menuItem.id, quantity: 1 }],
    });
  const orderId = createRes.body.id;

  const res = await request(app)
    .get(`/api/order/${orderId}`)
    .set('Authorization', `Bearer ${testUserAuthToken}`);
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('id', orderId);
});

test('addMenuItem', async () => {
  const res = await request(app)
    .post('/api/order/menu')
    .set('Authorization', `Bearer ${adminUser.token}`)
    .send({
      title: menuItem.title,
      description: menuItem.description,
      image: menuItem.image,
      price: menuItem.price,
    });
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('id');
  menuItem.id = res.body.id;
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}