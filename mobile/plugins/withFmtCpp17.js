const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// Xcode 26's clang mis-handles `consteval` in the bundled {fmt} library, so the
// `fmt` pod fails to compile ("fmt consteval error"). Apple now requires the
// iOS 26 SDK (Xcode 26) for App Store / TestFlight uploads, so we can't just use
// an older Xcode. Fix: compile ONLY the `fmt` pod as C++17 (consteval doesn't
// exist pre-C++20, so fmt falls back to runtime checks) and define
// FMT_USE_CONSTEVAL=0. Everything else keeps its normal C++ standard.
// Refs: facebook/react-native#55601, bleepingswift.com fmt-consteval-error.
const MARKER = "# >>> foreai: fmt C++17 fix for Xcode 26";
const SNIPPET = `
  ${MARKER}
  installer.pods_project.targets.each do |fmt_target|
    if fmt_target.name == 'fmt'
      fmt_target.build_configurations.each do |fmt_cfg|
        fmt_cfg.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        defs = fmt_cfg.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] || ['$(inherited)']
        defs = [defs] unless defs.is_a?(Array)
        defs << 'FMT_USE_CONSTEVAL=0' unless defs.include?('FMT_USE_CONSTEVAL=0')
        fmt_cfg.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs
      end
    end
  end
  # <<< foreai: fmt C++17 fix for Xcode 26
`;

module.exports = function withFmtCpp17(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      let contents = fs.readFileSync(podfilePath, "utf8");
      if (!contents.includes(MARKER)) {
        if (contents.includes("post_install do |installer|")) {
          contents = contents.replace(
            "post_install do |installer|",
            `post_install do |installer|\n${SNIPPET}`
          );
        } else {
          // Fallback: no existing post_install block — add one before the final end.
          contents = contents.replace(
            /\nend\s*$/,
            `\n  post_install do |installer|\n${SNIPPET}\n  end\nend\n`
          );
        }
        fs.writeFileSync(podfilePath, contents);
      }
      return cfg;
    },
  ]);
};
