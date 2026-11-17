const { AsyncLocalStorage } = require("async_hooks");
const config = require("./config");

const requestContext = new AsyncLocalStorage();
const SENSITIVE_KEY = /pass(word)?|token|jwt|api[-_]?key|authorization|secret/i;

class Logger {
  httpLogger = (req, res, next) => {
    let resBody;
    const send = res.send;
    res.send = function (body) {
      resBody = body;
      return send.call(this, body);
    };

    res.on("finish", () => {
      this.log(this.statusToLevel(res.statusCode), "http", {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        authorized: !!req.headers.authorization,
        userId: req.user?.id ?? null,
        reqBody: req.body,
        resBody: this.parse(resBody),
      });
    });
    requestContext.run({ req }, next);
  };
  dbLogger(sql) {
    this.log("info", "db", { userId: this.currentUserId(), sql });
  }

  factoryLogger({ statusCode, reqBody, resBody }) {
    this.log(this.statusToLevel(statusCode), "factory", {
      userId: this.currentUserId(),
      statusCode,
      reqBody,
      resBody,
    });
  }

  errorLogger(err, req) {
    this.log("error", "exception", {
      message: err.message,
      statusCode: err.statusCode ?? 500,
      method: req?.method,
      path: req?.originalUrl,
      userId: req?.user?.id ?? this.currentUserId(),
      stack: err.stack,
    });
  }
  currentUserId() {
    return requestContext.getStore()?.req?.user?.id ?? null;
  }

  statusToLevel(statusCode) {
    if (statusCode >= 500) return "error";
    if (statusCode >= 400) return "warn";
    return "info";
  }

  parse(body) {
    if (typeof body !== "string") return body;
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }

  sanitize(data) {
    return JSON.stringify(data, (key, value) =>
      SENSITIVE_KEY.test(key) ? "*****" : value,
    ).replace(/Bearer [\w.-]+/g, "Bearer *****");
  }
  log(level, type, data) {
    const labels = { component: config.logging.source, level, type };
    const values = [[`${Date.now()}000000`, this.sanitize(data)]];
    this.sendLogToGrafana({ streams: [{ stream: labels, values }] });
  }

  sendLogToGrafana(event) {
    if (process.env.NODE_ENV === "test") return;

    fetch(config.logging.endpointUrl, {
      method: "POST",
      body: JSON.stringify(event),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.logging.accountId}:${config.logging.apiKey}`,
      },
    })
      .then((res) => {
        if (!res.ok) console.log("Failed to send log to Grafana", res.status);
      })
      .catch((err) => console.log("Error sending log to Grafana", err.message));
  }
}
module.exports = new Logger();
