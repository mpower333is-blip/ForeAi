// Top-level build file. Versions are pinned to a known-good, stable set; Android
// Studio may offer newer ones — accept its upgrade suggestions if it prompts.
plugins {
    // AGP 8.6.x supports compileSdk 35 (Android 15 / Wear OS 5) and runs on
    // Gradle 8.7 — the version the CI wrapper fetches.
    id("com.android.application") version "8.6.1" apply false
    id("org.jetbrains.kotlin.android") version "1.9.24" apply false
}
