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
