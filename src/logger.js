const PizzaLogger = require('pizza-logger');

class Logger {
  constructor(loggingConfig) {
    // Initialize pizza-logger with your Grafana config
    this.logger = new PizzaLogger(loggingConfig);

    // Expose middleware & helpers
    this.httpLogger = this.logger.httpLogger;
    this.dbLogger = this.logger.dbLogger;
    this.factoryLogger = this.logger.factoryLogger;
    this.unhandledErrorLogger = this.logger.unhandledErrorLogger;
  }

  sanitize(logData) {
    logData = JSON.stringify(logData);
    return logData.replace(/\\"password\\":\s*\\"[^"]*\\"/g, '\\"password\\": \\"*****\\"');
  }
}

module.exports = Logger;