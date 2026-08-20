const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// Xcode 26's clang mis-handles `consteval` in the bundled {fmt} library, so any
// pod that compiles fmt's headers/sources fails ("fmt consteval error"). Apple
// now requires the iOS 26 SDK (Xcode 26) for App Store / TestFlight uploads, so
// we can't just use an older Xcode. Fix: define FMT_USE_CONSTEVAL=0 on EVERY pod
// target, which makes fmt use runtime format-string checking instead of the
// consteval path clang 26 chokes on. We deliberately do NOT change the C++
// language standard (that triggered a secondary error).
// Refs: facebook/react-native#55601, fmtlib/fmt#4065.
const MARKER = "# >>> foreai: disable fmt consteval for Xcode 26";
const SNIPPET = `
  ${MARKER}
  installer.pods_project.targets.each do |fmt_fix_target|
    fmt_fix_target.build_configurations.each do |fmt_fix_cfg|
      defs = fmt_fix_cfg.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] || ['$(inherited)']
      defs = [defs] unless defs.is_a?(Array)
      defs << 'FMT_USE_CONSTEVAL=0' unless defs.include?('FMT_USE_CONSTEVAL=0')
      fmt_fix_cfg.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs
    end
  end
  # <<< foreai: disable fmt consteval for Xcode 26
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
