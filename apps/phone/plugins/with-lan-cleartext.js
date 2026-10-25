// The phone reaches the TV's room host at ws://<TV address>:7777 on the home
// network (ADR-01, ADR-02). Android release builds block cleartext traffic by
// default, and a LAN IP cannot get a TLS certificate, so the phone allows it.
// The relay is reached over wss:// and does not need this.
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withLanCleartext(config) {
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (application !== undefined) application.$['android:usesCleartextTraffic'] = 'true';
    return mod;
  });
};
