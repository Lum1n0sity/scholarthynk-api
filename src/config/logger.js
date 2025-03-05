const pino = require("pino");

const transport = pino.transport({
    targets: [
        {
            target: "pino/file",
            options: {destination: "./logs/scholarthynk-api.log", mkdir: true, append: true}
        }
    ]
});

const logger = pino({level: "info"}, transport);

module.exports = logger;