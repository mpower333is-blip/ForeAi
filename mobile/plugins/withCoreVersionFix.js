// Align a few transitive Android dependencies that expo-iap's OpenIAP billing
// library drags in AHEAD of Expo SDK 53's toolchain, so the app builds on the
// AGP/Kotlin that SDK 53 ships:
//
//  1. androidx.core 1.18.0 → 1.16.0  (1.18 demands AGP 8.9.1; SDK 53 ships 8.8.2,
//     failing :app:checkReleaseAarMetadata).
//  2. Kotlin stdlib 2.2.x → 2.0.21 and kotlinx-coroutines 1.11.0 → 1.9.0 (SDK 53
//     compiles with Kotlin 2.0.21; the 2.0 compiler can't read 2.2 library
//     metadata, so :expo:compileReleaseKotlin fails with an internal error).
//
// Contained to a Gradle resolutionStrategy; no toolchain bump.
const { withAppBuildGradle } = require("@expo/config-plugins");

const MARKER = "// forceDeps (expo-iap toolchain compat)";
const BLOCK = `
${MARKER}
configurations.all {
    resolutionStrategy {
        force "androidx.core:core:1.16.0"
        force "androidx.core:core-ktx:1.16.0"
        force "org.jetbrains.kotlinx:kotlinx-coroutines-core:1.9.0"
        force "org.jetbrains.kotlinx:kotlinx-coroutines-core-jvm:1.9.0"
        force "org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0"
        eachDependency { details ->
            if (details.requested.group == "org.jetbrains.kotlin" && details.requested.name.startsWith("kotlin-stdlib")) {
                details.useVersion "2.0.21"
            }
        }
    }
}
`;

module.exports = function withCoreVersionFix(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents += BLOCK;
    }
    return cfg;
  });
};
