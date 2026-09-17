// Pin androidx.core to a version compatible with the Android Gradle Plugin that
// Expo SDK 53 ships (8.8.2). A transitive dependency (via expo-iap's OpenIAP
// billing lib) pulls androidx.core 1.18.0, whose AAR metadata demands AGP 8.9.1+,
// failing :app:checkReleaseAarMetadata. 1.16.0 is the newest core that builds on
// AGP 8.8.2 and is API-compatible with everything the app uses.
//
// (The Kotlin stdlib/coroutines version mismatch is handled separately by
// bumping the project Kotlin to 2.2.20 in app.config.js expo-build-properties —
// so we no longer force those down here.)
//
// Applied at the ROOT via allprojects{} so it reaches every module (:app, :expo…).
const { withProjectBuildGradle } = require("@expo/config-plugins");

const MARKER = "// forceDeps (expo-iap AGP compat)";
const BLOCK = `
${MARKER}
allprojects {
    configurations.all {
        resolutionStrategy {
            force "androidx.core:core:1.16.0"
            force "androidx.core:core-ktx:1.16.0"
        }
    }
}
`;

module.exports = function withCoreVersionFix(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents += BLOCK;
    }
    return cfg;
  });
};
