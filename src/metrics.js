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
        const timestamp = Date.now() * 1_000_000;
        const payload = {
            resourceMetrics: [{
                scopeMetrics: [{
                    metrics: [
                        {
                            name: 'http_requests_total',
                            gauge: {
                                dataPoints: Object.entries(this.httpRequests).map(([method, count]) => ({
                                    attributes: { method },
                                    asInt: count,
                                    timeUnixNano: timestamp.toString(),
                                })),
                            },
                        },
                        {
                            name: 'auth_attempts_total',
                            gauge: {
                                dataPoints: [
                                    { attributes: { outcome: 'success' }, asInt: this.authAttempts.success, timeUnixNano: timestamp.toString() },
                                    { attributes: { outcome: 'failure' }, asInt: this.authAttempts.failure, timeUnixNano: timestamp.toString() },
                                ],
                            },
                        },
                        {
                            name: 'pizza_purchases_total',
                            gauge: {
                                dataPoints: [
                                    { attributes: { outcome: 'success' }, asInt: this.pizzaPurchases.success, timeUnixNano: timestamp.toString() },
                                    { attributes: { outcome: 'failure' }, asInt: this.pizzaPurchases.failure, timeUnixNano: timestamp.toString() },
                                    { attributes: { outcome: 'revenue' }, asDouble: this.pizzaPurchases.totalRevenue, timeUnixNano: timestamp.toString() },
                                ],
                            },
                        },
                        {
                            name: 'memory_usage_percentage',
                            gauge: {
                                dataPoints: [ { asDouble: parseFloat(this.getMemoryUsagePercentage()), timeUnixNano: timestamp.toString() } ],
                            },
                        },
                        {
                            name: 'cpu_usage_percentage',
                            gauge: {
                                dataPoints: [ { asDouble: parseFloat(this.getCpuUsagePercentage()), timeUnixNano: timestamp.toString() } ],
                            },
                        },
                    ],
                }],
            }],
        };  

        try {
            const auth = `${config.metrics.accountId}:${config.metrics.apiKey}`;
            await fetch(config.metrics.endpointUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ` + Buffer.from(auth).toString('base64'),},
                body: JSON.stringify(payload),
            });
            this.httpRequests = {};
            this.authAttempts = {success: 0, failure: 0};
            this.pizzaPurchases = {success: 0, failure: 0, totalRevenue: 0};
        } catch (error) {
            console.log('Error sending metrics to Grafana', error);
        }
    }
    startPeriodicReporting(interval) {
        setInterval(() => this.sendToGrafana(), interval);
    }
}

const metrics = new Metrics();
metrics.startPeriodicReporting(5000);
module.exports = metrics;