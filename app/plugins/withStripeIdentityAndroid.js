// What Stripe's ID check needs on Android, applied when the native project is
// built (EAS Build or npx expo prebuild):
// 1. The app theme must be a Material Components theme.
// 2. Stripe's scanner brings Google's LiteRT image library as two parts that
//    share one internal namespace (org.tensorflow.lite.support). Android's
//    newer build tools stop on that by default; android.uniquePackageNames=false
//    lets it through, as it did before.
const { withAndroidStyles, withGradleProperties } = require("expo/config-plugins");

const MATERIAL = "Theme.MaterialComponents.DayNight.NoActionBar";

module.exports = function withStripeIdentityAndroid(config) {
  config = withAndroidStyles(config, cfg => {
    const app = (cfg.modResults.resources.style ?? []).find(s => s.$?.name === "AppTheme");
    if (app) app.$.parent = MATERIAL;
    return cfg;
  });
  config = withGradleProperties(config, cfg => {
    cfg.modResults = cfg.modResults.filter(p => !(p.type === "property" && p.key === "android.uniquePackageNames"));
    cfg.modResults.push({ type: "property", key: "android.uniquePackageNames", value: "false" });
    return cfg;
  });
  return config;
};
