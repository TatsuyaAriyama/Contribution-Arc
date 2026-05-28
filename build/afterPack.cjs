// Strip extended attributes from the packaged app before code signing.
// macOS Sequoia auto-attaches com.apple.provenance which causes codesign
// to fail with "resource fork, Finder information, or similar detritus
// not allowed". We aggressively strip every xattr immediately before
// the signing phase.

const { execSync } = require("node:child_process");

exports.default = async function afterPack(context) {
  const { appOutDir } = context;
  console.log("[afterPack] stripping xattrs in", appOutDir);
  try {
    execSync(`xattr -cr "${appOutDir}"`, { stdio: "inherit" });
    // Specifically strip com.apple.provenance which macOS re-applies
    execSync(`find "${appOutDir}" -exec xattr -d com.apple.provenance {} \\; 2>/dev/null || true`, { stdio: "inherit" });
    console.log("[afterPack] xattr cleanup complete");
  } catch (err) {
    console.warn("[afterPack] xattr cleanup warning:", err.message);
  }
};
