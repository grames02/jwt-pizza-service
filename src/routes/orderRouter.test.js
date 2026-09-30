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
});

test('getMenu', async () => {
  const res = await request(app)
    .get('/api/order/menu')
    .set('Authorization', `Bearer ${testUserAuthToken}`);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

test('addMenuItem', async () => {
  const res = await request(app)
    .put('/api/order/menu')
    .set('Authorization', `Bearer ${adminUser.token}`)
    .send(menuItem);
  expect(res.status).toBe(200);
});


test('createOrder', async () => {
  const res = await request(app)
    .post('/api/order')
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .send({franchiseId: 1, storeId: 1, items: [{ menuId: 1, description: menuItem.description, price: menuItem.price }] });
  expect(res.status).toBe(200);
});

test('createBadOrder', async () => {
  const res = await request(app)
    .post('/api/order')
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .send({franchiseId: 1, storeId: 1, items: [{ menuId: 9999, description: 'Non-existent item', price: 9.99 }] });
  expect(res.status).toBe(500);
});

test('Add menu item rejects non-admin user', async () => {
const res = await request(app)
    .put('/api/order/menu')
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .send(menuItem);
expect(res.status).toBe(403);
expect(res.body.message).toBe('unable to add menu item');
});

test('getOrder', async () => {
  const res = await request(app)
    .get('/api/order')
    .set('Authorization', `Bearer ${adminUser.token}`);
  expect(res.status).toBe(200);

});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}