{

"optimizations": \[

{

"title": "Avoid Barrel Exports to Enable Effective Tree Shaking",

"explanation": "Barrel files (e.g. index.ts exporting an entire folder) force Metro/Expo to pull in more modules than needed, which increases the initial bundle size.",

"actions": \[

"Replace imports like `import { Button } from \\"@/components\\";` with direct imports like `import { Button } from \\"@/components/Button\\";`.",

"Add an ESLint rule or project convention to forbid new barrel exports in performance-critical folders.",

"Re-run your bundle analysis to confirm the number of modules pulled into the entry chunk is reduced."

],

"anti_patterns": \[

"Centralizing all UI components into one barrel and importing from it everywhere.",

"Mixing CommonJS and ESM re-exports in the same barrel file.",

"Assuming the bundler will tree-shake unused exports when the file is referenced as a whole."

]

},

{

"title": "Run Regular Production Bundle Analysis (Atlas / Source Map Explorer)",

"explanation": "The document emphasizes inspecting the actual production bundle to spot libraries that are pulled in eagerly or that grew after a feature was added.",

"actions": \[

"Generate a production bundle with source maps and run `source-map-explorer` (or Expo Atlas) on CI.",

"Set a size budget (for example +80 KB per PR) and fail the pipeline when the budget is exceeded.",

"Track which packages (charts, bottom sheets, SVG, Supabase helpers) appear in the main bundle unexpectedly and refactor imports."

],

"anti_patterns": \[

"Only testing bundle size locally and not in CI.",

"Comparing dev bundles instead of production bundles.",

"Keeping demo/test utilities in the main bundle."

]

},

{

"title": "Ensure Android Does Not Compress the JS Bundle (Hermes mmap)",

"explanation": "If the Android build ends up compressing the JS bundle, Hermes cannot memory-map it efficiently, which increases startup time.",

"actions": \[

"In the prebuild/ejected Android project, update `android/app/build.gradle` to include:\\n`android { androidResources { noCompress += \[\\"bundle\\"] } }`.",

"Rebuild the release app and test startup time on a mid/low Android device.",

"Keep this check in your build scripts so future Expo/RN updates do not reintroduce compression."

],

"anti_patterns": \[

"Assuming Hermes will always mmap the bundle regardless of packaging.",

"Measuring startup only on an emulator.",

"Changing Gradle packaging rules without rebuilding a release APK/AAB."

]

},

{

"title": "Use Native Asset Delivery (iOS App Thinning / Android AAB Splits) for Images",

"explanation": "The document recommends moving images into the native asset pipeline so the store/platform only delivers density- and platform-appropriate assets, reducing download and install size.",

"actions": \[

"For iOS, place static images into an asset catalog and make sure the RN/Expo bundling step exports to it.",

"For Android, ship an AAB and verify Play Store splits assets per device density.",

"Pre-optimize images used in list/community screens to avoid loading oversized assets in JS."

],

"anti_patterns": \[

"Bundling large images directly via JS imports so every device downloads them.",

"Not providing @2x/@3x variants for common UI images.",

"Skipping store-level app size reports after adding media-heavy features."

]

}

]

}
