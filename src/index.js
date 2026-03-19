const app = require('./service.js');
const metrics = require('./metrics.js');
const config = require('./config.js'); // Make sure this has your absolute URL/API key

const port = process.argv[2] || 3000;

app.listen(port, () => {
  console.log(`Server started on port ${port}`);

  // Only start periodic reporting if URL is defined
  if (config.metrics.endpointUrl) {
    metrics.startPeriodicReporting(config.metrics.endpointUrl, config.metrics.apiKey);
  } else {
    console.warn('Metrics URL not defined. Skipping metrics reporting.');
  }
});