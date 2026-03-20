const os = require('os');
const fetch = require('node-fetch');
const config = require('./config.js');

class Metrics {
  constructor() {
    this.httpRequests = {};
    this.authAttempts = { success: 0, failure: 0 };
    this.pizzaPurchases = { success: 0, failure: 0, totalRevenue: 0 };
    console.log('--- METRICS CONFIG ---');
    console.log('Endpoint:', config.metrics.endpointUrl);
    console.log('Source:', config.metrics.source);
    console.log('Account ID:', config.metrics.accountId ? 'SET' : 'MISSING');
    console.log('API Key:', config.metrics.apiKey ? 'SET' : 'MISSING');
    console.log('----------------------');

    // Bind methods to preserve `this`
    this.requestTracker = this.requestTracker.bind(this);
    this.sendToGrafana = this.sendToGrafana.bind(this);
  }

  // Track HTTP requests
  requestTracker(req, res, next) {
  const method = req.method;
  if (!this.httpRequests[method]) this.httpRequests[method] = { count: 0, latency: [] };
  this.httpRequests[method].count += 1;

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start; // milliseconds
    this.httpRequests[method].latency.push(duration);
  });

  next();
}

  // Track auth attempts
  recordAuth(success) {
    if (success) this.authAttempts.success += 1;
    else this.authAttempts.failure += 1;
  }

  // Track pizza purchases
  pizzaPurchase(success, totalRevenue = 0) {
    if (success) this.pizzaPurchases.success += 1;
    else this.pizzaPurchases.failure += 1;

    this.pizzaPurchases.totalRevenue += totalRevenue;
  }

  // Memory usage in percentage
  getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    return ((usedMemory / totalMemory) * 100).toFixed(2);
  }

  getCpuUsagePercentage() {
  const cpus = os.cpus();
  if (!cpus || !cpus.length) return 0;

  // Use loadavg for Unix if supported
  const loadavg = os.loadavg();
  if (loadavg.some(n => n > 0)) {
    const usage = loadavg[0] / cpus.length;
    return (usage * 100).toFixed(2);
  }

  // Fallback for Windows: calculate CPU usage manually
  let totalIdle = 0, totalTick = 0;
  cpus.forEach(cpu => {
    for (const type in cpu.times) totalTick += cpu.times[type];
    totalIdle += cpu.times.idle;
  });

  const usage = 1 - totalIdle / totalTick;
  return (usage * 100).toFixed(2);
}

  async sendToGrafana() {
  console.log('\n[Metrics] sendToGrafana triggered at', new Date().toISOString());
  const timestamp = Date.now() * 1_000_000; // convert ms → ns

  const formatAttributes = (attrs) => {
    const arr = [];
    for (const key in attrs) {
      const value = attrs[key];
      if (typeof value === 'string') arr.push({ key, value: { stringValue: value } });
      else if (typeof value === 'number' && Number.isInteger(value)) arr.push({ key, value: { intValue: value } });
      else if (typeof value === 'number') arr.push({ key, value: { doubleValue: value } });
      else arr.push({ key, value: { stringValue: String(value) } });
    }
    return arr;
  };

  const metricsPayload = [];

  // --- HTTP requests ---
  Object.entries(this.httpRequests).forEach(([method, data]) => {
    if (!data.latency.length) return;
    const avgLatency = data.latency.reduce((a, b) => a + b, 0) / data.latency.length;
    metricsPayload.push({
      name: 'http_latency_ms',
      gauge: {
        dataPoints: [
          { doubleValue: avgLatency, timeUnixNano: timestamp.toString(), attributes: formatAttributes({ method, source: config.metrics.source }) }
        ]
      }
    });
  });

  // --- Auth attempts ---
  ['success', 'failure'].forEach(outcome => {
    metricsPayload.push({
      name: 'auth_attempts_total',
      unit: '%',
      gauge: {
        dataPoints: [
          { doubleValue: parseFloat(this.getMemoryUsagePercentage()), timeUnixNano: timestamp.toString(), attributes: formatAttributes({ source: config.metrics.source }) }
        ],
        aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
        isMonotonic: true,
      }
    });
  });

  // --- Pizza purchases ---
  ['success', 'failure'].forEach(outcome => {
    metricsPayload.push({
      name: 'pizza_purchases_total',
      sum: {
        dataPoints: [
          { asInt: this.pizzaPurchases[outcome], timeUnixNano: timestamp.toString(), attributes: formatAttributes({ outcome, source: config.metrics.source }) }
        ],
        aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
        isMonotonic: true,
      }
    });
  });

  metricsPayload.push({
    name: 'pizza_revenue_total',
    sum: {
      dataPoints: [
        { doubleValue: this.pizzaPurchases.totalRevenue, timeUnixNano: timestamp.toString(), attributes: formatAttributes({ source: config.metrics.source }) }
      ],
      aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
      isMonotonic: true,
    }
  });

  // --- Memory usage ---
  metricsPayload.push({
    name: 'memory_usage_percentage',
    gauge: {
      dataPoints: [
        { doubleValue: parseFloat(this.getMemoryUsagePercentage()), timeUnixNano: timestamp.toString(), attributes: formatAttributes({ source: config.metrics.source }) }
      ]
    }
  });

  // --- CPU usage ---
metricsPayload.push({
  name: 'cpu_percent',
  unit: '%',
  gauge: {
    dataPoints: [
      {
        doubleValue: parseFloat(this.getCpuUsagePercentage()),
        timeUnixNano: timestamp.toString(),
        attributes: formatAttributes({ source: config.metrics.source })
      }
    ]
  }
});

  // --- Wrap everything in resourceMetrics structure ---
  const body = {
    resourceMetrics: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: config.metrics.source } }
          ]
        },
        scopeMetrics: [
          {
            scope: { name: 'pizza-metrics' },
            metrics: metricsPayload
          }
        ]
      }
    ]
  };

  try {
    console.log('Sending payload to Grafana...');
    console.log('[Metrics] Payload preview:');
    console.dir(body, { depth: null });

    const res = await fetch(config.metrics.endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${config.metrics.accountId}:${config.metrics.apiKey}`).toString('base64')}`
      },
      body: JSON.stringify(body)
    });

    const text = await res.text();
    console.log('Grafana response status:', res.status);
    console.log('Grafana response body:', text);

    if (res.ok) {
      // Reset counters after successful send
      this.httpRequests = {};
      this.authAttempts = { success: 0, failure: 0 };
      this.pizzaPurchases = { success: 0, failure: 0, totalRevenue: 0 };
    } else {
      console.warn('Metrics not accepted by Grafana, counters not reset.');
    }
  } catch (err) {
    console.error('Error sending metrics to Grafana:', err);
  }
}

  // Start periodic reporting
  startPeriodicReporting(interval = 10000) {
    setInterval(this.sendToGrafana, interval);
  }
}

const metrics = new Metrics();
metrics.startPeriodicReporting(5000);
metrics.sendToGrafana();

module.exports = metrics;