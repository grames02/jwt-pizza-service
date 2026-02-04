const request = require('supertest');
const app = require('../service');
const { DB, Role } = require('../database/database.js');

// ===== Helpers =====
function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = `${user.name}@admin.com`;
  user = await DB.addUser(user);
  return { ...user, password: 'toomanysecrets' };
}

async function createNormalUser() {
  let user = { password: 'simplepass', roles: [{ role: Role.Diner }] };
  user.name = randomName();
  user.email = `${user.name}@test.com`;
  user = await DB.addUser(user);
  return { ...user, password: 'simplepass' };
}

// ===== Tests =====
describe('franchise router', () => {
  let adminUser;
  let adminToken;
  let normalUser;
  let normalToken;
  let franchiseId;
  let storeId;

  beforeAll(async () => {
    // Create admin and log in
    adminUser = await createAdminUser();
    const adminRes = await request(app)
      .put('/api/auth')
      .send({ email: adminUser.email, password: adminUser.password });
    adminToken = adminRes.body.token;

    // Create a normal user and log in
    normalUser = await createNormalUser();
    const userRes = await request(app)
      .put('/api/auth')
      .send({ email: normalUser.email, password: normalUser.password });
    normalToken = userRes.body.token;
  });

  // ===== Public GET =====
  test('GET /api/franchise returns franchises (public)', async () => {
    const res = await request(app).get('/api/franchise');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('franchises');
    expect(Array.isArray(res.body.franchises)).toBe(true);
    expect(res.body).toHaveProperty('more');
  });

  // ===== Non-admin restrictions =====
  test('non-admin cannot create a franchise', async () => {
    const res = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${normalToken}`)
      .send({ name: `Illegal ${randomName()}`, admins: [] });

    expect(res.status).toBe(403);
  });

  test('non-admin cannot delete a store', async () => {
    const res = await request(app)
      .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
      .set('Authorization', `Bearer ${normalToken}`);

    expect(res.status).toBe(403);
  });

  // ===== Admin actions =====
  test('admin can create a franchise', async () => {
    const res = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Franchise ${randomName()}`,
        admins: [{ email: adminUser.email }],
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');

    franchiseId = res.body.id;
  });

  test('admin can create a store for a franchise', async () => {
    const res = await request(app)
      .post(`/api/franchise/${franchiseId}/store`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Store ${randomName()}` });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');

    storeId = res.body.id;
  });

  test('admin can delete a store from a franchise', async () => {
    const res = await request(app)
      .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('store deleted');
  });

  // ===== Franchise deletion test =====
  test('franchise can be deleted without authentication', async () => {
    const res = await request(app)
      .delete(`/api/franchise/${franchiseId}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('franchise deleted');
  });
});

