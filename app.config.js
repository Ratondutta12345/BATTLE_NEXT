const fs = require('node:fs');
const path = require('node:path');

module.exports = ({ config }) => {
  const googleServicesPath = path.join(__dirname, 'google-services.json');
  return {
    ...config,
    android: {
      ...config.android,
      ...(fs.existsSync(googleServicesPath) ? { googleServicesFile: './google-services.json' } : {}),
    },
  };
};
