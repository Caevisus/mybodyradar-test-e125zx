// Android Gradle plugin v8.1.0
plugins {
    id("com.android.application") version "8.1.0"
    // Kotlin Android plugin v1.9.0
    id("org.jetbrains.kotlin.android") version "1.9.0"
    // Kotlin annotation processing v1.9.0
    id("org.jetbrains.kotlin.kapt") version "1.9.0"
    // Hilt dependency injection v2.47
    id("com.google.dagger.hilt.android") version "2.47"
}

android {
    namespace = "com.smartapparel.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.smartapparel.app"
        minSdk = 29
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }

        ndk {
            abiFilters += listOf("armeabi-v7a", "arm64-v8a", "x86_64")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            // ProGuard optimizations
            proguardFile("proguard-optimizations.pro")
            
            // Release-specific configurations
            buildConfigField("String", "API_BASE_URL", "\"https://api.smartapparel.com/\"")
            buildConfigField("boolean", "ENABLE_LOGGING", "false")
        }
        
        debug {
            isDebuggable = true
            // Debug-specific configurations
            buildConfigField("String", "API_BASE_URL", "\"https://dev-api.smartapparel.com/\"")
            buildConfigField("boolean", "ENABLE_LOGGING", "true")
            // Enable debugging tools while maintaining security
            proguardFiles(
                getDefaultProguardFile("proguard-android.txt"),
                "proguard-rules-debug.pro"
            )
        }
    }

    buildFeatures {
        viewBinding = true
        buildConfig = true
        compose = true
        aidl = true
        prefab = true
        renderScript = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.0"
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }

    kotlin {
        jvmToolchain(17)
    }

    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs = listOf(
            "-opt-in=kotlin.RequiresOptIn",
            "-opt-in=kotlinx.coroutines.ExperimentalCoroutinesApi",
            "-Xjvm-default=all",
            "-Xopt-in=kotlin.time.ExperimentalTime"
        )
    }

    testOptions {
        unitTests {
            isIncludeAndroidResources = true
            isReturnDefaultValues = true
        }
    }
}

dependencies {
    // AndroidX Core - v1.10.1
    implementation("androidx.core:core-ktx:1.10.1")
    
    // Compose UI - v1.5.0
    implementation("androidx.compose.ui:ui:1.5.0")
    implementation("androidx.compose.material3:material3:1.1.1")
    implementation("androidx.compose.ui:ui-tooling-preview:1.5.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.6.1")
    
    // Room Database - v2.5.2
    implementation("androidx.room:room-runtime:2.5.2")
    implementation("androidx.room:room-ktx:2.5.2")
    kapt("androidx.room:room-compiler:2.5.2")
    
    // Retrofit for networking - v2.9.0
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.11.0")
    
    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.7.3")
    
    // Hilt Dependency Injection
    implementation("com.google.dagger:hilt-android:2.47")
    kapt("com.google.dagger:hilt-compiler:2.47")
    
    // DataStore Preferences
    implementation("androidx.datastore:datastore-preferences:1.0.0")
    
    // WorkManager for background tasks
    implementation("androidx.work:work-runtime-ktx:2.8.1")
    
    // Security
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    
    // Bluetooth LE
    implementation("no.nordicsemi.android:ble:2.6.1")
    
    // Testing Dependencies
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
    
    // Debug Dependencies
    debugImplementation("androidx.compose.ui:ui-tooling:1.5.0")
    debugImplementation("androidx.compose.ui:ui-test-manifest:1.5.0")
    
    // Desugaring for newer Java features on older Android versions
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.0.3")
}

// Kapt Configuration
kapt {
    correctErrorTypes = true
    useBuildCache = true
}

// Hilt Configuration
hilt {
    enableAggregatingTask = true
}