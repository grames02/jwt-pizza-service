const os = require('os');
const fetch = require('node-fetch');
const config = require('./config.js');

class Metrics {
    constructor() {
        this.httpRequests = {};
        this.authAttempts = {success: 0, failure: 0};
        this.pizzaPurchases = {success: 0, failure: 0, totalRevenue: 0};
    }
    requestTracker(req, res, next) {
        const method = req.method;
        if (!this.httpRequests[method]) this.httpRequests[method] = 0;
        this.httpRequests[method] += 1;
        next();
    }
    
    recordAuth(success) {
        if (success) {
            this.authAttempts.success += 1;
        } else {
            this.authAttempts.failure += 1;
        }
    }
    pizzaPurchase(success, totalRevenue = 0) {
        if (success) {
            this.pizzaPurchases.success += 1;
        } else {
            this.pizzaPurchases.failure += 1;
        }
        this.pizzaPurchases.totalRevenue += totalRevenue;
    }

    getMemoryUsagePercentage() {
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const memoryUsage = (usedMemory / totalMemory) * 100;
        return memoryUsage.toFixed(2);
    }

    getCpuUsagePercentage() {
        const cpuUsage = os.loadavg()[0] / os.cpus().length;
        return cpuUsage.toFixed(2) * 100;
    }
    
    async sendToGrafana() {
    const timestamp = Date.now() * 1_000_000; // nanoseconds

    // Helper to format attributes correctly for OTLP
    const formatAttributes = (attrs) => {
        const arr = [];
        for (const key in attrs) {
            const value = attrs[key];
            if (typeof value === 'string') arr.push({ key, value: { stringValue: value } });
            else if (typeof value === 'number' && Number.isInteger(value)) arr.push({ key, value: { intValue: value } });
            else if (typeof value === 'number') arr.push({ key, value: { doubleValue: value } });
            else arr.push({ key, value: { stringValue: String(value) } }); // fallback
        }
        return arr;
    };

    // Build metrics array
    const metrics = [];

    // HTTP requests
    Object.entries(this.httpRequests).forEach(([method, count]) => {
        metrics.push({
            name: 'http_requests_total',
            sum: {
                dataPoints: [{
                    asInt: count,
                    timeUnixNano: timestamp.toString(),
                    attributes: formatAttributes({ method, source: config.metrics.source })
                }],
                aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
                isMonotonic: true,
            }
        });
    });

    // Auth attempts
    ['success', 'failure'].forEach(outcome => {
        metrics.push({
            name: 'auth_attempts_total',
            sum: {
                dataPoints: [{
                    asInt: this.authAttempts[outcome],
                    timeUnixNano: timestamp.toString(),
                    attributes: formatAttributes({ outcome, source: config.metrics.source })
                }],
                aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
                isMonotonic: true,
            }
        });
    });

    // Pizza purchases
    ['success', 'failure'].forEach(outcome => {
        metrics.push({
            name: 'pizza_purchases_total',
            sum: {
                dataPoints: [{
                    asInt: this.pizzaPurchases[outcome],
                    timeUnixNano: timestamp.toString(),
                    attributes: formatAttributes({ outcome, source: config.metrics.source })
                }],
                aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
                isMonotonic: true,
            }
        });
    });

    // Total revenue
    metrics.push({
        name: 'pizza_revenue_total',
        sum: {
            dataPoints: [{
                doubleValue: this.pizzaPurchases.totalRevenue,
                timeUnixNano: timestamp.toString(),
                attributes: formatAttributes({ source: config.metrics.source })
            }],
            aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
            isMonotonic: true,
        }
    });

    // Memory usage
    metrics.push({
        name: 'memory_usage_percentage',
        gauge: {
            dataPoints: [{
                doubleValue: parseFloat(this.getMemoryUsagePercentage()),
                timeUnixNano: timestamp.toString(),
                attributes: formatAttributes({ source: config.metrics.source })
            }]
        }
    });

    // CPU usage
    metrics.push({
        name: 'cpu_percent',
        gauge: {
            dataPoints: [{
                doubleValue: parseFloat(this.getCpuUsagePercentage()),
                timeUnixNano: timestamp.toString(),
                attributes: formatAttributes({ source: config.metrics.source })
            }]
        }
    });

    // Build the OTLP payload
    const body = {
        resourceMetrics: [
            {
                scopeMetrics: [
                    { metrics }
                ]
            }
        ]
    };

    try {
        console.log('Sending payload to Grafana:', JSON.stringify(body, null, 2));

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
            // Reset counters only on success
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

       
    startPeriodicReporting(interval) {
        setInterval(() => this.sendToGrafana(), interval);
    }
}

const metrics = new Metrics();
metrics.startPeriodicReporting(5000);
module.exports = metrics;