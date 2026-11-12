plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "app.phonecare.diagnostics"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.phonecare.diagnostics"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

// No third-party runtime dependencies: the app uses only the Android framework
// and the Kotlin standard library. That keeps the APK small and the build simple.
dependencies {
    testImplementation("junit:junit:4.13.2")
}
