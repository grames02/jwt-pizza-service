const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}


async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  user = await DB.addUser(user);
  return { ...user, password: 'toomanysecrets' };
}


let adminUser;
let franchiseId;
let storeId;

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

test('list franchises', async () => {
    
    const response = await request(app).get('/api/franchise').set('Authorization', `Bearer ${adminUser.token}`);
    expect(response.status).toBe(200);
});

test('Admin create franchise', async () => {
    const res = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({
        name: `Franchise ${randomName()}`,
        admins: [{ email: adminUser.email }],
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');

    franchiseId = res.body.id;
});

test('Unable to make franchise, not admin', async () => {
    const res = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${testUser.token}`)
      .send({
        name: `Franchise ${randomName()}`,
        admins: [{ email: adminUser.email }],
      });

    expect(res.status).toBe(403);
});

test('get user franchises', async () => {
  const response = await request(app)
    .get(`/api/franchise/${franchiseId}`)
    .set('Authorization', `Bearer ${adminUser.token}`);
  expect(response.status).toBe(200);
});

test('admin create store', async () => {
    const res = await request(app)
      .post(`/api/franchise/${franchiseId}/store`)
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({
        name: `Store ${randomName()}`,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    storeId = res.body.id;
});

test('unable to make store, not admin', async () => {
    const res = await request(app)
      .post(`/api/franchise/${franchiseId}/store`)
      .set('Authorization', `Bearer ${testUser.token}`)
      .send({
        name: `Store ${randomName()}`,
      });

    expect(res.status).toBe(403);
});

test('unable to delete store, not admin', async () => {
    const res = await request(app)
      .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
      .set('Authorization', `Bearer ${testUser.token}`);

    expect(res.status).toBe(403);
});

test('admin delete store', async () => {
    const res = await request(app)
      .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
      .set('Authorization', `Bearer ${adminUser.token}`);

    expect(res.status).toBe(200);
});

test('admin delete franchise', async () => {
    const res = await request(app)
      .delete(`/api/franchise/${franchiseId}`)
      .set('Authorization', `Bearer ${adminUser.token}`);

    expect(res.status).toBe(200);
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}