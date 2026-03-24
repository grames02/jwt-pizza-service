const Logger = require('pizza-logger');
const config = require('./config.js');

const logger = new Logger(config);

// Database Logger
function sendLogToGrafana(event) {
    const body = JSON.stringify(event);
    fetch(`${config.url}`, {
        method: 'post',
        body: body,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.accountId}:${config.apiKey}`,
        },
    }).then((res) => {
        if (!res.ok) console.log('Failed to send log to Grafana');
    });
}

// Unhandled Error Logger
class StatusCodeError extends Error {
    constructor(message, statusCode) {
        super(message);
        logger.unhandledErrorLogger(this);
        this.statusCode = statusCode;
    }
}

// createOrder
orderRouter.post(
    '/',
    authRouter.authenticateToken,
    asyncHandler(async (req, res) => {
        const orderReq = req.body;
        const order = await DB.addDinerOrder(req.user, orderReq);
        const orderInfo = { diner: { id: req.user.id, name: req.user.name, email: req.user.email }, order };
        logger.factoryLogger(orderInfo);
    })
);