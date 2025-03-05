const app = require('./app');
const port = process.env.PORT || 3000;

const logger = require('./config/logger');

app.listen(port => {
    logger.info(`Server running on port ${port}`);
    console.log(`Server running on port ${port}`);
});