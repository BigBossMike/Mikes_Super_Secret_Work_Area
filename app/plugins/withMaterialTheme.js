// Stripe's ID check needs the Android app theme to be a Material Components
// theme. Expo generates the theme, so this plugin changes its parent when the
// native project is built (EAS Build or npx expo prebuild).
const { withAndroidStyles } = require("expo/config-plugins");

const MATERIAL = "Theme.MaterialComponents.DayNight.NoActionBar";

module.exports = function withMaterialTheme(config) {
  return withAndroidStyles(config, cfg => {
    const styles = cfg.modResults.resources.style ?? [];
    const app = styles.find(s => s.$?.name === "AppTheme");
    if (app) app.$.parent = MATERIAL;
    return cfg;
  });
};
