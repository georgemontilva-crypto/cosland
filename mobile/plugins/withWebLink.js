// Le dice a Android que esta app y la web de Cosland son lo mismo. Con eso el navegador puede saber
// que la app ya está instalada y la web deja de ofrecer la descarga (navigator.getInstalledRelatedApps).
const { withStringsXml, withAndroidManifest, AndroidConfig } = require("expo/config-plugins");

module.exports = function withWebLink(config, { site } = {}) {
  if (!site) return config;
  const statements = JSON.stringify([{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "web", site } }]).replace(/"/g, '\\"');
  config = withStringsXml(config, (cfg) => {
    cfg.modResults = AndroidConfig.Strings.setStringItem([{ $: { name: "asset_statements", translatable: "false" }, _: statements }], cfg.modResults);
    return cfg;
  });
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app["meta-data"] = (app["meta-data"] ?? []).filter((m) => m.$["android:name"] !== "asset_statements");
    app["meta-data"].push({ $: { "android:name": "asset_statements", "android:resource": "@string/asset_statements" } });
    return cfg;
  });
};
