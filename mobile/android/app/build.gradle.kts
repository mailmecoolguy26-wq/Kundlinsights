plugins {
    id("com.android.application")
    id("com.google.gms.google-services")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val releaseStoreFile = providers.gradleProperty("TARAVERSE_RELEASE_STORE_FILE")
    .orElse(providers.environmentVariable("TARAVERSE_RELEASE_STORE_FILE"))
val releaseStorePassword = providers.gradleProperty("TARAVERSE_RELEASE_STORE_PASSWORD")
    .orElse(providers.environmentVariable("TARAVERSE_RELEASE_STORE_PASSWORD"))
val releaseKeyAlias = providers.gradleProperty("TARAVERSE_RELEASE_KEY_ALIAS")
    .orElse(providers.environmentVariable("TARAVERSE_RELEASE_KEY_ALIAS"))
val releaseKeyPassword = providers.gradleProperty("TARAVERSE_RELEASE_KEY_PASSWORD")
    .orElse(providers.environmentVariable("TARAVERSE_RELEASE_KEY_PASSWORD"))
val isReleaseRequested = gradle.startParameter.taskNames.any {
    it.contains("Release", ignoreCase = true)
}

android {
    namespace = "com.kundlinsights.kundlinsights_mobile"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.kundlinsights.kundlinsights_mobile"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            if (isReleaseRequested) {
                val values = listOf(
                    releaseStoreFile.orNull,
                    releaseStorePassword.orNull,
                    releaseKeyAlias.orNull,
                    releaseKeyPassword.orNull,
                )
                check(values.all { !it.isNullOrBlank() }) {
                    "Release signing requires TARAVERSE_RELEASE_STORE_FILE, " +
                        "TARAVERSE_RELEASE_STORE_PASSWORD, " +
                        "TARAVERSE_RELEASE_KEY_ALIAS, and " +
                        "TARAVERSE_RELEASE_KEY_PASSWORD."
                }
                signingConfig = signingConfigs.create("release") {
                    storeFile = file(releaseStoreFile.get())
                    storePassword = releaseStorePassword.get()
                    keyAlias = releaseKeyAlias.get()
                    keyPassword = releaseKeyPassword.get()
                }
            }
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
