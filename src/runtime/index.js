'use strict';
module.exports = { ...require('./production-config'), ...require('./production-runtime'), ...require('./start-production'), ...require('./development-config'), ...require('./development-runtime'), ...require('./create-development-astrology'), ...require('./start-development') };
