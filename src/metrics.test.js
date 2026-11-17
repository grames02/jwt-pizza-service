const metrics = require("./metrics");

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test("builds and sends metrics to Grafana", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true });

  metrics.authAttempt(true);
  metrics.authAttempt(false);
  metrics.userActive(1);
  metrics.userLoggedOut(1);
  metrics.pizzaPurchase(true, 100, 0.05, 2);
  metrics.pizzaPurchase(false, 200, 0, 0);

  const timer = metrics.sendMetricsPeriodically(1000);
  await jest.advanceTimersByTimeAsync(1000);
  clearInterval(timer);

  expect(fetch).toHaveBeenCalledTimes(1);
  const body = JSON.parse(fetch.mock.calls[0][1].body);
  const names = body.resourceMetrics[0].scopeMetrics[0].metrics.map(
    (m) => m.name,
  );
  expect(names).toContain("http_requests");
  expect(names).toContain("pizza_revenue");
});

test("logs when Grafana rejects the push", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: false, status: 400, text: async () => "bad" });
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});

  const timer = metrics.sendMetricsPeriodically(1000);
  await jest.advanceTimersByTimeAsync(1000);
  clearInterval(timer);

  expect(spy).toHaveBeenCalled();
  spy.mockRestore();
});
