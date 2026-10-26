const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withLanCleartext(config) {
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (application !== undefined) application.$['android:usesCleartextTraffic'] = 'true';
    return mod;
  });
};
