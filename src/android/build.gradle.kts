// Project-level build.gradle.kts for Smart Apparel Android Application
// Plugin versions
buildscript {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
    dependencies {
        // Android Gradle Plugin v8.1.0
        classpath("com.android.tools.build:gradle:8.1.0")
        // Kotlin Gradle Plugin v1.9.0
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.0")
        // Hilt Android Plugin v2.47
        classpath("com.google.dagger:hilt-android-gradle-plugin:2.47")
        // Google Services Plugin v4.4.0
        classpath("com.google.gms:google-services:4.4.0")
    }
}

// Project configuration
allprojects {
    repositories {
        google()
        mavenCentral()
    }

    // Security configurations
    configurations.all {
        // Enable dependency verification
        resolutionStrategy {
            enableDependencyVerification()
            failOnVersionConflict()
            preferProjectModules()
        }

        // Enable security scanning
        withDependencyConstraints {
            implementation("org.owasp:dependency-check-gradle:8.2.1")
        }
    }
}

// Clean task configuration
tasks.register<Delete>("clean") {
    delete(rootProject.buildDir)
    group = "build"
    description = "Deletes the build directory and all build artifacts"
}

// Performance optimizations
gradle.projectsLoaded {
    gradle.rootProject {
        allprojects {
            // Enable configuration caching
            enableConfigurationCache()
            // Enable parallel execution
            enableParallelExecution()
            // Enable build cache
            buildCache {
                local {
                    isEnabled = true
                    directory = File(rootDir, "build-cache")
                }
            }
        }
    }
}

// Common project configurations
subprojects {
    afterEvaluate {
        // Apply common configurations to all subprojects
        project.apply {
            // Enable strict API mode for Kotlin
            plugins.withId("org.jetbrains.kotlin.android") {
                kotlin {
                    explicitApi()
                }
            }
            
            // Configure Java compatibility
            plugins.withType<JavaBasePlugin> {
                configure<JavaPluginExtension> {
                    sourceCompatibility = JavaVersion.VERSION_17
                    targetCompatibility = JavaVersion.VERSION_17
                }
            }
        }
    }
}

// Project-wide Gradle settings
gradle.properties {
    // Enable Gradle Daemon
    "org.gradle.daemon=true"
    // Configure JVM arguments
    "org.gradle.jvmargs=-Xmx4g -XX:+HeapDumpOnOutOfMemoryError -XX:+UseParallelGC"
    // Enable configuration on demand
    "org.gradle.configureondemand=true"
    // Enable parallel execution
    "org.gradle.parallel=true"
    // Enable configuration cache
    "org.gradle.configuration-cache=true"
    // Enable build cache
    "org.gradle.caching=true"
    // Android specific settings
    "android.useAndroidX=true"
    "android.enableJetifier=false"
    "android.nonTransitiveRClass=true"
    // Kotlin specific settings
    "kotlin.code.style=official"
    "kotlin.incremental=true"
    "kotlin.incremental.js=true"
    "kotlin.incremental.multiplatform=true"
    // Security settings
    "android.enableR8.fullMode=true"
    "android.enableResourceOptimizations=true"
}