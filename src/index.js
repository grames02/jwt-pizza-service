const app = require('./service.js');
const metrics = require('./metrics.js');
const config = require('./config.js'); // contains metrics.endpointUrl, apiKey, accountId, etc.

// Attach metrics middleware BEFORE listening
app.use(metrics.requestTracker);

const port = process.argv[2] || 3000;

app.listen(port, () => {
  console.log(`Server started on port ${port}`);

  // Only start periodic reporting if metrics URL is defined
  if (config.metrics.endpointUrl) {
    metrics.startPeriodicReporting(5000); // interval in ms
  } else {
    console.warn('Metrics URL not defined. Skipping metrics reporting.');
  }
});