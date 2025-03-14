const pino = require("pino");

const transport = pino.transport({
    targets: [
        {
            target: "pino/file",
            options: {destination: "./logs/scholarthynk-api.log", mkdir: true, append: true}
        }
    ]
});

const logger = pino({level: "info", timestamp: pino.stdTimeFunctions.isoTime}, transport);

module.exports = logger;