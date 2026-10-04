// Applies Cindy's settings to the generated Android and iOS projects. Safe to run any number of times
// (the CI builds run it after `cap sync`). Reads optional env vars:
//   CINDY_VERSION_CODE / CINDY_VERSION_NAME  — app version for the stores
import fs from "node:fs";

const read = p => fs.readFileSync(p, "utf8");
const write = (p, s) => fs.writeFileSync(p, s);
const VCODE = process.env.CINDY_VERSION_CODE || "";
const VNAME = process.env.CINDY_VERSION_NAME || "";

// ---------------------------------------------------------------- Android
if (fs.existsSync("android")) {
  const A = "android/app/src/main";

  // launcher icons + launch screens (generated from the logo by tools/make-resources.py)
  fs.cpSync("resources/android", `${A}/res`, { recursive: true, force: true });
  write(`${A}/res/values/ic_launcher_background.xml`,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FFFFFF</color>\n</resources>\n`);

  // small icon for reminder notifications (a white paper plane — Android tints it)
  write(`${A}/res/drawable/ic_stat_cindy.xml`,
    `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">\n` +
    `    <path android:fillColor="#FFFFFFFF" android:pathData="M2.01,21L23,12 2.01,3 2,10l15,2 -15,2z"/>\n</vector>\n`);

  // manifest: don't back this app's local data up to Google Drive; declare the permissions we use
  let m = read(`${A}/AndroidManifest.xml`);
  m = m.replace('android:allowBackup="true"', 'android:allowBackup="false"');
  for (const perm of ["android.permission.POST_NOTIFICATIONS", "android.permission.USE_BIOMETRIC"]) {
    if (!m.includes(perm)) m = m.replace("</manifest>", `    <uses-permission android:name="${perm}" />\n</manifest>`);
  }
  write(`${A}/AndroidManifest.xml`, m);

  // app/build.gradle: version from env, release signing from env
  let g = read("android/app/build.gradle");
  if (!g.includes("CINDY_KEYSTORE_PATH")) {
    g = g.replace(/versionCode \d+/, 'versionCode Integer.parseInt(System.getenv("CINDY_VERSION_CODE") ?: "1")');
    g = g.replace(/versionName "[^"]*"/, 'versionName (System.getenv("CINDY_VERSION_NAME") ?: "1.0.0")');
    g = g.replace("    buildTypes {",
`    signingConfigs {
        release {
            def ksPath = System.getenv("CINDY_KEYSTORE_PATH")
            if (ksPath) {
                storeFile file(ksPath)
                storePassword System.getenv("CINDY_KEYSTORE_PASSWORD")
                keyAlias System.getenv("CINDY_KEY_ALIAS")
                keyPassword System.getenv("CINDY_KEY_PASSWORD") ?: System.getenv("CINDY_KEYSTORE_PASSWORD")
            }
        }
    }
    buildTypes {`);
    g = g.replace("        release {\n            minifyEnabled false",
`        release {
            if (System.getenv("CINDY_KEYSTORE_PATH")) { signingConfig signingConfigs.release }
            minifyEnabled false`);
    write("android/app/build.gradle", g);
  }
  console.log("android configured");
}

// -------------------------------------------------------------------- iOS
if (fs.existsSync("ios")) {
  const I = "ios/App";

  // iPhone only
  let proj = read(`${I}/App.xcodeproj/project.pbxproj`);
  proj = proj.split('TARGETED_DEVICE_FAMILY = "1,2";').join("TARGETED_DEVICE_FAMILY = 1;");
  if (VNAME) proj = proj.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${VNAME};`);
  if (VCODE) proj = proj.replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${VCODE};`);
  write(`${I}/App.xcodeproj/project.pbxproj`, proj);

  // Info.plist: arm64, no export-compliance prompt, Face ID reason, drop iPad orientations
  let p = read(`${I}/App/Info.plist`);
  p = p.replace("<string>armv7</string>", "<string>arm64</string>");
  if (!p.includes("ITSAppUsesNonExemptEncryption")) {
    p = p.replace("</dict>\n</plist>", "\t<key>ITSAppUsesNonExemptEncryption</key>\n\t<false/>\n</dict>\n</plist>");
  }
  if (!p.includes("NSFaceIDUsageDescription")) {
    p = p.replace("</dict>\n</plist>", "\t<key>NSFaceIDUsageDescription</key>\n\t<string>Cindy uses Face ID to keep your résumé and job search private.</string>\n</dict>\n</plist>");
  }
  p = p.replace(/\t<key>UISupportedInterfaceOrientations~ipad<\/key>\s*<array>[\s\S]*?<\/array>\n/, "");
  write(`${I}/App/Info.plist`, p);

  // icon + launch screen
  fs.copyFileSync("resources/ios/AppIcon-1024.png", `${I}/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`);
  for (const n of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
    fs.copyFileSync("resources/ios/splash-2732.png", `${I}/App/Assets.xcassets/Splash.imageset/${n}`);
  }
  console.log("ios configured");
}
