'use strict';
module.exports = { ...require('./production-config'), ...require('./production-runtime'), ...require('./create-development-astrology'), ...require('./development-config'), ...require('./development-local-kms'), ...require('./development-runtime'), ...require('./start-development') };
