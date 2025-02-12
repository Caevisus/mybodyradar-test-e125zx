// Project name definition
rootProject.name = "smart-apparel"

// Plugin management configuration with version control and security
pluginManagement {
    // Secure repository configuration for plugin resolution
    repositories {
        // com.android.tools.build:gradle:8.1.0
        google()
        // org.jetbrains.kotlin.android:1.9.0, com.google.dagger.hilt.android:2.47
        mavenCentral()
        // Fallback for other Gradle plugins
        gradlePluginPortal()
    }

    // Plugin version resolution strategy
    resolutionStrategy {
        eachPlugin {
            when {
                // Android Gradle Plugin resolution
                requested.id.namespace == "com.android" -> {
                    useModule("com.android.tools.build:gradle:8.1.0")
                }
                // Kotlin plugin resolution
                requested.id.namespace == "org.jetbrains.kotlin" -> {
                    useVersion("1.9.0")
                }
                // Hilt dependency injection plugin resolution
                requested.id.namespace == "com.google.dagger" -> {
                    useVersion("2.47")
                }
            }
        }
    }
}

// Dependency resolution management with strict security controls
dependencyResolutionManagement {
    // Enforce repository declarations in the root build script only
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    
    // Secure repository configuration for dependency resolution
    repositories {
        // Android-specific dependencies
        google()
        // General dependencies with security verification
        mavenCentral()
    }
}

// Include application module with verification
include(":app")