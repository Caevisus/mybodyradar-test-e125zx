# Smart Apparel Android Application ProGuard Rules
# Version: 1.0.0

# Global Optimization Settings
-optimizationpasses 7
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-verbose
-allowaccessmodification
-mergeinterfacesaggressively

# Keep Annotations and Signatures
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-keepattributes Exceptions,InnerClasses,RuntimeVisibleAnnotations,RuntimeVisibleParameterAnnotations

# Kotlin Specific Rules
-keep class kotlin.Metadata { *; }
-dontwarn kotlin.**
-keepclassmembers class **$WhenMappings {
    <fields>;
}
-keepclassmembers class kotlin.Metadata {
    public <methods>;
}

# Hilt Dependency Injection Rules - v2.47
-keepclasseswithmembers class * {
    @dagger.* <methods>;
}
-keep @dagger.hilt.android.HiltAndroidApp class * extends android.app.Application
-keep @com.google.dagger.hilt.android.lifecycle.HiltViewModel public class * extends androidx.lifecycle.ViewModel
-keep class com.google.dagger.hilt.** { *; }

# Retrofit Network Rules - v2.9.0
-keepattributes Signature
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}
-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement
-dontwarn javax.annotation.**
-dontwarn kotlin.Unit
-dontwarn retrofit2.KotlinExtensions
-dontwarn retrofit2.KotlinExtensions$*

# OkHttp Rules - v4.11.0
-dontwarn okhttp3.**
-dontwarn okio.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase
-keepclassmembers class * implements javax.net.ssl.SSLSocketFactory {
    private final javax.net.ssl.SSLSocketFactory delegate;
}

# Room Database Rules - v2.5.2
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
-dontwarn androidx.room.paging.**
-keep class * extends androidx.room.DatabaseConfiguration
-keepclassmembers class * extends androidx.room.RoomDatabase {
    public static <methods>;
}

# Smart Apparel Sensor Data Models and Processing
-keep class com.smartapparel.app.domain.models.** { *; }
-keep class com.smartapparel.app.data.api.ApiService { *; }
-keep class com.smartapparel.app.data.db.dao.** { *; }
-keep class com.smartapparel.app.data.db.entities.** { *; }
-keep class com.smartapparel.app.sensor.** { *; }
-keep class com.smartapparel.app.realtime.** { *; }

# Security Related Rules
-keep class com.smartapparel.app.security.** { *; }
-keepclassmembers class * extends com.smartapparel.app.security.Encrypted { *; }
-keepclassmembers class * {
    @androidx.annotation.Keep *;
}

# Native Method Protection
-keepclasseswithmembernames class * {
    native <methods>;
}

# Sensor Data Processing Optimization
-optimizations !code/simplification/arithmetic,!code/allocation/variable
-keepclassmembers class * implements android.os.Parcelable {
    static ** CREATOR;
}

# Bluetooth LE Components
-keep class no.nordicsemi.android.ble.** { *; }
-dontwarn no.nordicsemi.android.ble.**

# Remove Logging in Release
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
    public static *** w(...);
    public static *** e(...);
}

# Crash Reporting Preservation
-keepattributes LineNumberTable,SourceFile
-renamesourcefileattribute SourceFile

# JSON Serialization
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# WorkManager Components
-keep class * extends androidx.work.Worker
-keep class * extends androidx.work.ListenableWorker
-keepclassmembers class * extends androidx.work.ListenableWorker {
    public <init>(android.content.Context,androidx.work.WorkerParameters);
}

# Coroutines
-keepclassmembernames class kotlinx.** {
    volatile <fields>;
}
-keepclassmembers class kotlin.coroutines.Continuation {
    *;
}

# DataStore
-keep class androidx.datastore.*.** { *; }

# Security Crypto
-keep class androidx.security.crypto.** { *; }
-keep class * extends androidx.security.crypto.MasterKey$Builder

# Performance Optimization
-repackageclasses 'com.smartapparel.app'
-allowaccessmodification
-overloadaggressively