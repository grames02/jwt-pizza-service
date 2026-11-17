const app = require("./service.js");
const metrics = require("./metrics.js");
const logger = require("./logger.js");

const port = process.argv[2] || 3000;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

metrics.sendMetricsPeriodically(10000);
process.on("unhandledRejection", (err) => logger.errorLogger(err));
process.on("uncaughtException", (err) => {
  logger.errorLogger(err);
  setTimeout(() => process.exit(1), 1000); // give the log time to send, then let ECS restart
});
