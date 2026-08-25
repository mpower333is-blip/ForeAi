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
        // `applicationId` is the install identity Play matches on. It's set to
        // the SAME id as the phone app so this AAB is delivered as the Wear OS
        // form factor of the com.foreai.mobile listing (not a separate app).
        // applicationId can differ from namespace — only the install id must match.
        applicationId = "com.foreai.mobile"
        minSdk = 30 // Wear OS 3+
        targetSdk = 35
        // Play requires a higher versionCode on every upload. CI sets
        // ANDROID_VERSION_CODE to the build number; locally it's 1.
        versionCode = (System.getenv("ANDROID_VERSION_CODE") ?: "1").toInt()
        versionName = "1.0"
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
