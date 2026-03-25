class Logger {
  constructor(loggingConfig) {
    this.logger = new PizzaLogger(loggingConfig);

    // wrap httpLogger to avoid undefined resBody crashes
    this.httpLogger = (req, res, next) => {
      const originalSend = res.send;
      res.send = (body) => {
        try {
          // ensure resBody is always a string or object
          this.logger.httpLogger(req, res, body ?? '');
        } catch (err) {
          console.error('PizzaLogger error:', err);
        }
        return originalSend.call(res, body);
      };
      next();
    };

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