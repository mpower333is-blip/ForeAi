plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    // `namespace` is the code package (where the Kotlin sources + R/BuildConfig
    // live) — kept as com.foreai.wear so the source tree doesn't move.
    namespace = "com.foreai.wear"
    // API 35 (Android 15 / Wear OS 5) — Google Play's minimum target for new apps.
    compileSdk = 35

    defaultConfig {
        // `applicationId` is the install identity Play matches on. The watch
        // ships inside the SAME Play app as the phone (com.foreai.mobile), as its
        // Wear OS form factor — in Play you pick "mobile" or "Wear OS" per
        // release, and the watch bundle must carry the phone's package to be
        // accepted. applicationId can differ from namespace (kept as
        // com.foreai.wear) — only the install id must match the app.
        //
        // Club flavours (e.g. Kempton) build the SAME watch source with a
        // different install id / name / backend via env vars, so the club's watch
        // ships inside its own Play app. Defaults keep the ForeAi build unchanged.
        applicationId = System.getenv("WEAR_APP_ID") ?: "com.foreai.mobile"
        minSdk = 30 // Wear OS 3+
        targetSdk = 35
        // Same app as the phone → versionCodes must be unique across both. CI
        // offsets the watch into the 90000+ range (see codemagic.yaml) so it
        // never collides with the phone's low numbers. versionName is shown as 1.0.
        versionCode = (System.getenv("ANDROID_VERSION_CODE") ?: "1").toInt()
        versionName = "1.0"
        // Watch display name + backend, overridable per flavour (defaults = ForeAi).
        resValue("string", "app_name", System.getenv("WEAR_APP_NAME") ?: "ForeAi Golf")
        buildConfigField(
            "String",
            "API_BASE",
            "\"${System.getenv("WEAR_API_BASE") ?: "https://foreai-backend.onrender.com"}\"",
        )
        // Standalone rangefinder config. WEAR_COURSE_ID names the bundled course
        // card the watch shows straight away (green GPS, par, length) with NO
        // backend — so the app is fully usable offline the moment it opens (e.g.
        // "kempton-park"). WEAR_EVENT_CODE is optional: set it only when a live
        // scoring backend exists, and the watch then also layers on player pick +
        // live score sync. Left blank (the default) the watch never touches the
        // network and works purely as a GPS rangefinder — which is what Play's
        // reviewer sees, so it can't crash on or hang against an unreachable server.
        buildConfigField(
            "String",
            "DEFAULT_COURSE_ID",
            "\"${System.getenv("WEAR_COURSE_ID") ?: ""}\"",
        )
        buildConfigField(
            "String",
            "EVENT_CODE",
            "\"${System.getenv("WEAR_EVENT_CODE") ?: ""}\"",
        )
        // Public status endpoint (Cloud Function `watchStatus`) the watch polls for
        // the club's live lightning-safety level and the next tee times. Blank ->
        // those two on-wrist extras are simply hidden; the rangefinder still works.
        buildConfigField(
            "String",
            "STATUS_URL",
            "\"${System.getenv("WEAR_STATUS_URL") ?: ""}\"",
        )
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true // for API_BASE (buildConfigField above)
    }
    composeOptions {
        // Matches Kotlin 1.9.24 (see the Compose–Kotlin compatibility map).
        kotlinCompilerExtensionVersion = "1.5.14"
    }
}

dependencies {
    // Wear-specific Compose UI.
    implementation(platform("androidx.compose:compose-bom:2024.06.00"))
    implementation("androidx.wear.compose:compose-material:1.3.1")
    implementation("androidx.wear.compose:compose-foundation:1.3.1")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")

    implementation("androidx.activity:activity-compose:1.9.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.3")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.3")
    implementation("androidx.core:core-splashscreen:1.0.1")

    // Networking to the ForeAi backend (JSON parsed with the built-in org.json).
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
