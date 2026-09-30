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

test('getFranchises', async () => {
  const res = await request(app)
    .get('/api/franchises')
    .set('Authorization', `Bearer ${testUserAuthToken}`);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

test('getUserFranchises', async () => {
  const res = await request(app)
    .get('/api/franchises/user')
    .set('Authorization', `Bearer ${testUserAuthToken}`);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

test('createFranchise', async () => {
  const newFranchise = { name: 'New Franchise', location: 'Test Location' };
  const res = await request(app)
    .post('/api/franchises')
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .send(newFranchise);
  expect(res.status).toBe(201);
  expect(res.body).toMatchObject(newFranchise);
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}