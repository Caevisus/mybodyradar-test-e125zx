package com.smartapparel.app.di

import com.apollographql.apollo3.ApolloClient // version: 3.8.2
import com.apollographql.apollo3.cache.normalized.api.MemoryCacheFactory
import com.apollographql.apollo3.network.okHttpClient
import com.github.benmanes.caffeine.cache.Cache // version: 3.1.8
import com.github.benmanes.caffeine.cache.Caffeine
import com.smartapparel.app.data.api.ApiService
import com.smartapparel.app.data.api.GraphQLService
import com.smartapparel.app.data.api.WebSocketService
import com.smartapparel.app.utils.API_CONFIG
import dagger.Module // version: 2.48
import dagger.Provides // version: 2.48
import dagger.hilt.InstallIn // version: 2.48
import dagger.hilt.components.SingletonComponent // version: 2.48
import io.github.resilience4j.circuitbreaker.CircuitBreaker // version: 2.1.0
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry
import io.micrometer.core.instrument.MeterRegistry // version: 1.11.0
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import okhttp3.CertificatePinner
import okhttp3.ConnectionPool
import okhttp3.OkHttpClient
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit // version: 2.9.0
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideCircuitBreakerRegistry(): CircuitBreakerRegistry {
        val config = CircuitBreakerConfig.custom()
            .failureRateThreshold(50f)
            .waitDurationInOpenState(java.time.Duration.ofSeconds(30))
            .slidingWindowSize(10)
            .minimumNumberOfCalls(5)
            .build()
        return CircuitBreakerRegistry.of(config)
    }

    @Provides
    @Singleton
    fun provideMeterRegistry(): MeterRegistry {
        return SimpleMeterRegistry()
    }

    @Provides
    @Singleton
    fun provideResponseCache(): Cache<String, Response> {
        return Caffeine.newBuilder()
            .maximumSize(1000)
            .expireAfterWrite(5, TimeUnit.MINUTES)
            .recordStats()
            .build()
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(
        circuitBreakerRegistry: CircuitBreakerRegistry,
        meterRegistry: MeterRegistry
    ): OkHttpClient {
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        val certificatePinner = CertificatePinner.Builder()
            .add("api.smartapparel.com", "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
            .build()

        val circuitBreaker = circuitBreakerRegistry.circuitBreaker("http-client")

        return OkHttpClient.Builder()
            .connectionPool(ConnectionPool(32, 5, TimeUnit.MINUTES))
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .addInterceptor { chain ->
                val startTime = System.nanoTime()
                try {
                    circuitBreaker.executeCallable {
                        chain.proceed(chain.request())
                    }.also {
                        meterRegistry.timer("http.request.duration")
                            .record(System.nanoTime() - startTime, TimeUnit.NANOSECONDS)
                    }
                } catch (e: Exception) {
                    meterRegistry.counter("http.request.error").increment()
                    throw e
                }
            }
            .addInterceptor(loggingInterceptor)
            .certificatePinner(certificatePinner)
            .retryOnConnectionFailure(true)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(
        client: OkHttpClient,
        responseCache: Cache<String, Response>
    ): Retrofit {
        return Retrofit.Builder()
            .baseUrl(API_CONFIG.BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideApiService(retrofit: Retrofit): ApiService {
        return retrofit.create(ApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideApolloClient(
        client: OkHttpClient,
        responseCache: Cache<String, Response>
    ): ApolloClient {
        return ApolloClient.Builder()
            .serverUrl("${API_CONFIG.BASE_URL}/graphql")
            .okHttpClient(client)
            .normalizedCache(MemoryCacheFactory(maxSizeBytes = 10 * 1024 * 1024))
            .build()
    }

    @Provides
    @Singleton
    fun provideGraphQLService(apolloClient: ApolloClient): GraphQLService {
        return GraphQLService()
    }

    @Provides
    @Singleton
    fun provideWebSocketService(
        client: OkHttpClient,
        circuitBreakerRegistry: CircuitBreakerRegistry
    ): WebSocketService {
        return WebSocketService(
            sensorService = SensorService(),
            metricsCollector = MetricsCollector(),
            gson = com.google.gson.Gson()
        )
    }
}