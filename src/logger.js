import fetch from 'node-fetch';
import asyncHandler from 'express-async-handler';
import orderRouter from './routes/orderRouter.js';
import authRouter from './routes/authRouter.js';
import DB from './db.js';


const Logger = require('pizza-logger');
const config = require('./config.js');

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
// class StatusCodeError extends Error {
//     constructor(message, statusCode) {
//         super(message);
//         logger.unhandledErrorLogger(this);
//         this.statusCode = statusCode;
//     }
// }

// createOrder
orderRouter.post(
    '/',
    authRouter.authenticateToken,
    asyncHandler(async (req) => {
        const orderReq = req.body;
        const order = await DB.addDinerOrder(req.user, orderReq);
        const orderInfo = { diner: { id: req.user.id, name: req.user.name, email: req.user.email }, order };
        logger.factoryLogger(orderInfo);
    })
);

const logger = new Logger(config);
logger.sendLogToGrafana();
module.exports = logger;