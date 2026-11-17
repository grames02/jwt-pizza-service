const os = require("os");
const config = require("./config");

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return memoryUsage.toFixed(2);
}

// State
const requests = { GET: 0, POST: 0, PUT: 0, DELETE: 0 };
const auth = { success: 0, failure: 0 };
const pizza = { sold: 0, failures: 0, revenue: 0 };
const latency = {
  endpoint: { totalMs: 0, count: 0 },
  pizza: { totalMs: 0, count: 0 },
};

const activeUsers = new Map();
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
const startTimeUnixNano = `${Date.now()}000000`;

function requestTracker(req, res, next) {
  const start = process.hrtime.bigint();
  if (req.method in requests) requests[req.method]++;

  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    latency.endpoint.totalMs += ms;
    latency.endpoint.count++;
  });

  next();
}

function authAttempt(success) {
  success ? auth.success++ : auth.failure++;
}

function userActive(id) {
  activeUsers.set(id, Date.now());
}

function userLoggedOut(id) {
  activeUsers.delete(id);
}

function pizzaPurchase(success, latencyMs, price, count) {
  latency.pizza.totalMs += latencyMs;
  latency.pizza.count++;
  if (success) {
    pizza.sold += count;
    pizza.revenue += price;
  } else {
    pizza.failures++;
  }
}

// ---------- Calculations ----------
function cpuTimes() {
  return os.cpus().reduce(
    (acc, cpu) => {
      const t = cpu.times;
      acc.idle += t.idle;
      acc.total += t.user + t.nice + t.sys + t.idle + t.irq;
      return acc;
    },
    { idle: 0, total: 0 },
  );
}

let lastCpu = cpuTimes();
function getCpuUsagePercentage() {
  // Works on Windows too (os.loadavg() always returns 0 there)
  const now = cpuTimes();
  const idle = now.idle - lastCpu.idle;
  const total = now.total - lastCpu.total;
  lastCpu = now;
  return total > 0 ? (1 - idle / total) * 100 : 0;
}

function getMemoryUsagePercentage() {
  const total = os.totalmem();
  return ((total - os.freemem()) / total) * 100;
}

function countActiveUsers() {
  const cutoff = Date.now() - ACTIVE_WINDOW_MS;
  for (const [id, lastSeen] of activeUsers) {
    if (lastSeen < cutoff) activeUsers.delete(id);
  }
  return activeUsers.size;
}

function averageAndReset(bucket) {
  const avg = bucket.count > 0 ? bucket.totalMs / bucket.count : 0;
  bucket.totalMs = 0;
  bucket.count = 0;
  return avg;
}

// ---------- OTLP builders ----------
function attributes(extra = {}) {
  return Object.entries({ source: config.metrics.source, ...extra }).map(
    ([key, value]) => ({
      key,
      value: { stringValue: String(value) },
    }),
  );
}

function point(value, extraAttrs = {}, type = "asInt") {
  return {
    [type]: value,
    timeUnixNano: `${Date.now()}000000`,
    attributes: attributes(extraAttrs),
  };
}

function sum(name, unit, dataPoints) {
  return {
    name,
    unit,
    sum: {
      dataPoints: dataPoints.map((p) => ({ ...p, startTimeUnixNano })),
      aggregationTemporality: "AGGREGATION_TEMPORALITY_CUMULATIVE",
      isMonotonic: true,
    },
  };
}

function gauge(name, unit, dataPoints) {
  return { name, unit, gauge: { dataPoints } };
}

function buildMetrics() {
  return [
    sum(
      "http_requests",
      "1",
      Object.entries(requests).map(([method, n]) => point(n, { method })),
    ),
    sum(
      "auth_attempts",
      "1",
      Object.entries(auth).map(([status, n]) => point(n, { status })),
    ),
    gauge("active_users", "1", [point(countActiveUsers())]),
    gauge("cpu_usage", "%", [point(getCpuUsagePercentage(), {}, "asDouble")]),
    gauge("memory_usage", "%", [
      point(getMemoryUsagePercentage(), {}, "asDouble"),
    ]),
    sum("pizzas_sold", "1", [point(pizza.sold)]),
    sum("pizza_creation_failures", "1", [point(pizza.failures)]),
    sum("pizza_revenue", "1", [point(pizza.revenue, {}, "asDouble")]),
    gauge("endpoint_latency", "ms", [
      point(averageAndReset(latency.endpoint), {}, "asDouble"),
    ]),
    gauge("pizza_creation_latency", "ms", [
      point(averageAndReset(latency.pizza), {}, "asDouble"),
    ]),
  ];
}

// ---------- Sending ----------
async function sendToGrafana(metrics) {
  const body = JSON.stringify({
    resourceMetrics: [
      {
        resource: {
          attributes: [
            {
              key: "service.name",
              value: { stringValue: config.metrics.source },
            },
          ],
        },
        scopeMetrics: [{ metrics }],
      },
    ],
  });

  try {
    const res = await fetch(config.metrics.endpointUrl, {
      method: "POST",
      body,
      headers: {
        Authorization: `Bearer ${config.metrics.accountId}:${config.metrics.apiKey}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      console.error(
        `Failed to push metrics (${res.status}): ${await res.text()}`,
      );
    }
  } catch (err) {
    console.error("Error pushing metrics:", err.message);
  }
}

function sendMetricsPeriodically(periodMs) {
  return setInterval(() => {
    try {
      sendToGrafana(buildMetrics());
    } catch (err) {
      console.error("Error building metrics:", err);
    }
  }, periodMs);
}

module.exports = {
  requestTracker,
  authAttempt,
  userActive,
  userLoggedOut,
  pizzaPurchase,
  sendMetricsPeriodically,
};
