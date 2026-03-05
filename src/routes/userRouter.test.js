// const request = require('supertest');
// const app = require('../service');

// function randomEmail() {
//   return Math.random().toString(36).substring(2, 12) + '@test.com';
// }

// describe('user router', () => {
//   let userToken;
//   let userId;

//   beforeAll(async () => {
//     // Register a fresh user
//     const res = await request(app)
//       .post('/api/auth')
//       .send({
//         name: 'user test',
//         email: randomEmail(),
//         password: 'password123',
//       });

//     userToken = res.body.token;
//     userId = res.body.user.id;
//   });

//   test('GET /api/user/me returns authenticated user', async () => {
//     const res = await request(app)
//       .get('/api/user/me')
//       .set('Authorization', `Bearer ${userToken}`);

//     expect(res.status).toBe(200);
//     expect(res.body).toHaveProperty('id', userId);
//     expect(res.body).toHaveProperty('email');
//     expect(res.body).toHaveProperty('roles');
//   });

//   test('user can update their own profile', async () => {
//     const res = await request(app)
//       .put(`/api/user/${userId}`)
//       .set('Authorization', `Bearer ${userToken}`)
//       .send({
//         name: 'updated name',
//         email: randomEmail(),
//         password: 'newpassword',
//       });

//     expect(res.status).toBe(200);
//     expect(res.body).toHaveProperty('user');
//     expect(res.body.user.name).toBe('updated name');
//     expect(res.body).toHaveProperty('token');
//   });

//   test('non-admin cannot update another user', async () => {
//     const res = await request(app)
//       .put('/api/user/9999')
//       .set('Authorization', `Bearer ${userToken}`)
//       .send({ name: 'hacker' });

//     expect(res.status).toBe(403);
//     expect(res.body.message).toBe('unauthorized');
//   });
//   test('list users unauthorized', async () => {
//   const listUsersRes = await request(app).get('/api/user');
//   expect(listUsersRes.status).toBe(401);
// });

// test('list users as admin', async () => {
//   // Login using the known admin credentials
//   const loginRes = await request(app)
//     .put('/api/auth')
//     .send({ email: 'a@jwt.com', password: 'admin' });
//   console.log(loginRes.status, loginRes.body);

//   const adminToken = loginRes.body.token;

//   const res = await request(app)
//     .get('/api/user')
//     .set('Authorization', `Bearer ${adminToken}`);

//   expect(res.status).toBe(200);
//   expect(res.body).toHaveProperty('users');
//   expect(Array.isArray(res.body.users)).toBe(true);
//   expect(res.body).toHaveProperty('more');
// });

// async function registerUser(service) {
//   const testUser = {
//     name: 'pizza diner',
//     email: `${randomName()}@test.com`,
//     password: 'a',
//   };
//   const registerRes = await service.post('/api/auth').send(testUser);
//   registerRes.body.user.password = testUser.password;

//   return [registerRes.body.user, registerRes.body.token];
// }

// function randomName() {
//   return Math.random().toString(36).substring(2, 12);
// }
// });