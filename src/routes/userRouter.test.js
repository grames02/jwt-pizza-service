const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let adminUser;
let testUserAuthToken;

async function createAdminUser() {
  let user = { password: "toomanysecrets", roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + "@admin.com";

  user = await DB.addUser(user);
  return { ...user, password: "toomanysecrets" };
}

beforeAll(async () => {
  adminUser = await createAdminUser();
  const adminRes = await request(app)
    .put("/api/auth")
    .send({ email: adminUser.email, password: adminUser.password });
  adminUser.token = adminRes.body.token;
  expectValidJwt(adminUser.token);

  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
});

test("getUserProfile", async () => {
  const res = await request(app)
    .get(`/api/user/me`)
    .set("Authorization", `Bearer ${testUserAuthToken}`);
  expect(res.status).toBe(200);
  expect(res.body.email).toBe(testUser.email);
});

test("updateUserProfile", async () => {
  const newName = randomName();
  const res = await request(app)
    .put(`/api/user/${adminUser.id}`)
    .set("Authorization", `Bearer ${adminUser.token}`)
    .send({
      name: newName,
      email: adminUser.email,
      password: adminUser.password,
    });
  expect(res.status).toBe(200);
  expect(res.body.user.name).toBe(newName);
});

test("list users unauthorized", async () => {
  const listUsersRes = await request(app).get("/api/user");
  expect(listUsersRes.status).toBe(401);
});

test("list users", async () => {
  const [user, userToken] = await registerUser(request(app));
  const listUsersRes = await request(app)
    .get("/api/user")
    .set("Authorization", "Bearer " + userToken);
  expect(listUsersRes.status).toBe(200);
});

async function registerUser(service) {
  const testUser = {
    name: "pizza diner",
    email: `${randomName()}@test.com`,
    password: "a",
  };
  const registerRes = await service.post("/api/auth").send(testUser);
  registerRes.body.user.password = testUser.password;

  return [registerRes.body.user, registerRes.body.token];
}

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/,
  );
}
