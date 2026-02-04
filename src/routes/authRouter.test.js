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