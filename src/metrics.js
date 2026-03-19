const os = require('os');
const fetch = require('node-fetch');
const config = require('./config.js');

class Metrics {
  constructor() {
    this.httpRequests = {};
    this.authAttempts = { success: 0, failure: 0 };
    this.pizzaPurchases = { success: 0, failure: 0, totalRevenue: 0 };

    // Bind methods to preserve `this` context
    this.requestTracker = this.requestTracker.bind(this);
    this.sendToGrafana = this.sendToGrafana.bind(this);
  }

  // Track HTTP requests
  requestTracker(req, res, next) {
    const method = req.method;
    this.httpRequests[method] = (this.httpRequests[method] || 0) + 1;
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

  // CPU usage percentage
  getCpuUsagePercentage() {
    if (os.loadavg().every((n) => n === 0)) {
      // Fallback for Windows
      const cpus = os.cpus();
      let totalIdle = 0, totalTick = 0;

      cpus.forEach((cpu) => {
        for (const type in cpu.times) totalTick += cpu.times[type];
        totalIdle += cpu.times.idle;
      });

      return ((1 - totalIdle / totalTick) * 100).toFixed(2);
    } else {
      const usage = os.loadavg()[0] / os.cpus().length;
      return (usage * 100).toFixed(2);
    }
  }

  // Format attributes for Grafana
  formatAttributes(attrs) {
    return Object.entries(attrs).map(([key, value]) => {
      if (typeof value === 'string') return { key, value: { stringValue: value } };
      if (Number.isInteger(value)) return { key, value: { intValue: value } };
      if (typeof value === 'number') return { key, value: { doubleValue: value } };
      return { key, value: { stringValue: String(value) } };
    });
  }

  // Send metrics to Grafana
  async sendToGrafana() {
    const timestamp = (Date.now() * 1_000_000).toString(); // nanoseconds

    const metrics = [];

    // HTTP requests
    Object.entries(this.httpRequests).forEach(([method, count]) => {
      metrics.push({
        name: 'http_requests_total',
        sum: {
          dataPoints: [
            { asInt: count, timeUnixNano: timestamp, attributes: this.formatAttributes({ method, source: config.metrics.source }) },
          ],
          aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
          isMonotonic: true,
        },
      });
    });

    // Auth attempts
    ['success', 'failure'].forEach((outcome) => {
      metrics.push({
        name: 'auth_attempts_total',
        sum: {
          dataPoints: [
            { asInt: this.authAttempts[outcome], timeUnixNano: timestamp, attributes: this.formatAttributes({ outcome, source: config.metrics.source }) },
          ],
          aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
          isMonotonic: true,
        },
      });
    });

    // Pizza purchases
    ['success', 'failure'].forEach((outcome) => {
      metrics.push({
        name: 'pizza_purchases_total',
        sum: {
          dataPoints: [
            { asInt: this.pizzaPurchases[outcome], timeUnixNano: timestamp, attributes: this.formatAttributes({ outcome, source: config.metrics.source }) },
          ],
          aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
          isMonotonic: true,
        },
      });
    });

    // Total revenue
    metrics.push({
      name: 'pizza_revenue_total',
      sum: {
        dataPoints: [
          { doubleValue: this.pizzaPurchases.totalRevenue, timeUnixNano: timestamp, attributes: this.formatAttributes({ source: config.metrics.source }) },
        ],
        aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
        isMonotonic: true,
      },
    });

    // Memory usage
    metrics.push({
      name: 'memory_usage_percentage',
      gauge: {
        dataPoints: [
          { doubleValue: parseFloat(this.getMemoryUsagePercentage()), timeUnixNano: timestamp, attributes: this.formatAttributes({ source: config.metrics.source }) },
        ],
      },
    });

    // CPU usage
    metrics.push({
      name: 'cpu_percent',
      gauge: {
        dataPoints: [
          { doubleValue: parseFloat(this.getCpuUsagePercentage()), timeUnixNano: timestamp, attributes: this.formatAttributes({ source: config.metrics.source }) },
        ],
      },
    });

    const body = { resourceMetrics: [{ scopeMetrics: [{ metrics }] }] };

    try {
      const res = await fetch(config.metrics.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${config.metrics.accountId}:${config.metrics.apiKey}`).toString('base64')}`,
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      console.log('Grafana response status:', res.status);
      console.log('Grafana response body:', text);

      if (res.ok) {
        // Reset counters on success
        this.httpRequests = {};
        this.authAttempts = { success: 0, failure: 0 };
        this.pizzaPurchases = { success: 0, failure: 0, totalRevenue: 0 };
      } else {
        console.warn('Metrics not accepted by Grafana; counters not reset.');
      }
    } catch (err) {
      console.error('Error sending metrics to Grafana:', err);
    }
  }

  // Start periodic reporting
  startPeriodicReporting(interval = 5000) {
    setInterval(this.sendToGrafana, interval);
  }
}

// Instantiate and start reporting
const metrics = new Metrics();
metrics.startPeriodicReporting(5000);

module.exports = metrics;


// const os = require('os');
// const fetch = require('node-fetch');
// const config = require('./config.js');

// class Metrics {
//   constructor() {
//     this.httpRequests = {};
//     this.authAttempts = { success: 0, failure: 0 };
//     this.pizzaPurchases = { success: 0, failure: 0, totalRevenue: 0 };

//     // Bind methods to preserve `this`
//     this.requestTracker = this.requestTracker.bind(this);
//     this.sendToGrafana = this.sendToGrafana.bind(this);
//   }

//   // Track HTTP requests
//   requestTracker(req, res, next) {
//     const method = req.method;
//     if (!this.httpRequests[method]) this.httpRequests[method] = 0;
//     this.httpRequests[method] += 1;
//     next();
//   }

//   // Track auth attempts
//   recordAuth(success) {
//     if (success) this.authAttempts.success += 1;
//     else this.authAttempts.failure += 1;
//   }

//   // Track pizza purchases
//   pizzaPurchase(success, totalRevenue = 0) {
//     if (success) this.pizzaPurchases.success += 1;
//     else this.pizzaPurchases.failure += 1;

//     this.pizzaPurchases.totalRevenue += totalRevenue;
//   }

//   // Memory usage in percentage
//   getMemoryUsagePercentage() {
//     const totalMemory = os.totalmem();
//     const freeMemory = os.freemem();
//     const usedMemory = totalMemory - freeMemory;
//     return ((usedMemory / totalMemory) * 100).toFixed(2);
//   }

//   // CPU usage percentage (works cross-platform)
//   getCpuUsagePercentage() {
//     // Windows doesn't support loadavg; fallback to CPU time calculation
//     if (os.loadavg().every((n) => n === 0)) {
//       const cpus = os.cpus();
//       let totalIdle = 0, totalTick = 0;

//       cpus.forEach((cpu) => {
//         for (const type in cpu.times) {
//           totalTick += cpu.times[type];
//         }
//         totalIdle += cpu.times.idle;
//       });

//       const usage = 1 - totalIdle / totalTick;
//       return (usage * 100).toFixed(2);
//     } else {
//       // Use loadavg for Unix
//       const usage = os.loadavg()[0] / os.cpus().length;
//       return (usage * 100).toFixed(2);
//     }
//   }

//   // Send metrics to Grafana
//   async sendToGrafana() {
//     const timestamp = Date.now() * 1_000_000; // nanoseconds

//     const formatAttributes = (attrs) => {
//       const arr = [];
//       for (const key in attrs) {
//         const value = attrs[key];
//         if (typeof value === 'string') arr.push({ key, value: { stringValue: value } });
//         else if (typeof value === 'number' && Number.isInteger(value)) arr.push({ key, value: { intValue: value } });
//         else if (typeof value === 'number') arr.push({ key, value: { doubleValue: value } });
//         else arr.push({ key, value: { stringValue: String(value) } });
//       }
//       return arr;
//     };

//     const metrics = [];

//     // HTTP requests
//     Object.entries(this.httpRequests).forEach(([method, count]) => {
//       metrics.push({
//         name: 'http_requests_total',
//         sum: {
//           dataPoints: [
//             { asInt: count, timeUnixNano: timestamp.toString(), attributes: formatAttributes({ method, source: config.metrics.source }) }
//           ],
//           aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
//           isMonotonic: true,
//         }
//       });
//     });

//     // Auth attempts
//     ['success', 'failure'].forEach(outcome => {
//       metrics.push({
//         name: 'auth_attempts_total',
//         sum: {
//           dataPoints: [
//             { asInt: this.authAttempts[outcome], timeUnixNano: timestamp.toString(), attributes: formatAttributes({ outcome, source: config.metrics.source }) }
//           ],
//           aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
//           isMonotonic: true,
//         }
//       });
//     });

//     // Pizza purchases
//     ['success', 'failure'].forEach(outcome => {
//       metrics.push({
//         name: 'pizza_purchases_total',
//         sum: {
//           dataPoints: [
//             { asInt: this.pizzaPurchases[outcome], timeUnixNano: timestamp.toString(), attributes: formatAttributes({ outcome, source: config.metrics.source }) }
//           ],
//           aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
//           isMonotonic: true,
//         }
//       });
//     });

//     // Total revenue
//     metrics.push({
//       name: 'pizza_revenue_total',
//       sum: {
//         dataPoints: [
//           { doubleValue: this.pizzaPurchases.totalRevenue, timeUnixNano: timestamp.toString(), attributes: formatAttributes({ source: config.metrics.source }) }
//         ],
//         aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
//         isMonotonic: true,
//       }
//     });

//     // Memory usage
//     metrics.push({
//       name: 'memory_usage_percentage',
//       gauge: {
//         dataPoints: [
//           { doubleValue: parseFloat(this.getMemoryUsagePercentage()), timeUnixNano: timestamp.toString(), attributes: formatAttributes({ source: config.metrics.source }) }
//         ]
//       }
//     });

//     // CPU usage
//     metrics.push({
//       name: 'cpu_percent',
//       gauge: {
//         dataPoints: [
//           { doubleValue: parseFloat(this.getCpuUsagePercentage()), timeUnixNano: timestamp.toString(), attributes: formatAttributes({ source: config.metrics.source }) }
//         ]
//       }
//     });

//     const body = { resourceMetrics: [{ scopeMetrics: [{ metrics }] }] };

//     try {
//       console.log('Sending payload to Grafana...');
//       const res = await fetch(config.metrics.endpointUrl, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Basic ${Buffer.from(`${config.metrics.accountId}:${config.metrics.apiKey}`).toString('base64')}`
//         },
//         body: JSON.stringify(body)
//       });

//       const text = await res.text();
//       console.log('Grafana response status:', res.status);
//       console.log('Grafana response body:', text);

//       if (res.ok) {
//         // reset counters on success
//         this.httpRequests = {};
//         this.authAttempts = { success: 0, failure: 0 };
//         this.pizzaPurchases = { success: 0, failure: 0, totalRevenue: 0 };
//       } else {
//         console.warn('Metrics not accepted by Grafana, counters not reset.');
//       }
//     } catch (err) {
//       console.error('Error sending metrics to Grafana:', err);
//     }
//   }

//   // Start periodic reporting
//   startPeriodicReporting(interval = 5000) {
//     setInterval(this.sendToGrafana, interval);
//   }
// }

// const metrics = new Metrics();
// metrics.startPeriodicReporting(5000);

// module.exports = metrics;