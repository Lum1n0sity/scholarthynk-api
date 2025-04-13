const pino = require("pino");
const {v4: uuidv4} = require("uuid");

const transport = pino.transport({
    targets: [
        {
            target: "pino/file",
            options: {destination: "./logs/scholarthynk-api.log", mkdir: true, append: true}
        }
    ]
});

const logger = pino({
    level: "info",
    timestamp: pino.stdTimeFunctions.isoTime,
    mixin() {
        return { id: uuidv4() };
    }
}, transport);

module.exports = logger;