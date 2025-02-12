package com.smartapparel.app.data.api

import com.apollographql.apollo3.ApolloClient
import com.apollographql.apollo3.api.*
import com.apollographql.apollo3.cache.normalized.api.MemoryCacheFactory
import com.apollographql.apollo3.cache.normalized.normalizedCache
import com.apollographql.apollo3.network.okHttpClient
import com.apollographql.apollo3.exception.ApolloException
import com.apollographql.apollo3.network.ws.WebSocketNetworkTransport
import com.apollographql.apollo3.network.ws.WebSocketConnection
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.withTimeout
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import java.util.concurrent.TimeUnit
import com.smartapparel.app.utils.API_CONFIG
import com.smartapparel.app.domain.models.SensorData
import java.security.cert.X509Certificate
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager

/**
 * Enterprise-grade GraphQL service implementing real-time data synchronization
 * with enhanced security, caching, and error handling capabilities.
 *
 * @property apolloClient Configured Apollo client instance
 * @property connectionState Current WebSocket connection state
 * @version 1.0
 */
class GraphQLService {

    private val httpClient: OkHttpClient
    private val apolloClient: ApolloClient
    private val _connectionState = MutableStateFlow<ConnectionState>(ConnectionState.Disconnected)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    init {
        httpClient = buildHttpClient()
        apolloClient = buildApolloClient()
    }

    /**
     * Executes a GraphQL query with caching and retry support.
     *
     * @param T Generic type parameter for query response
     * @param query GraphQL query operation
     * @param variables Query variables map
     * @param cachePolicy Cache policy for the query
     * @return Query response with cache status
     */
    suspend fun <T : Query.Data> executeQuery(
        query: Query<T>,
        variables: Map<String, Any> = emptyMap(),
        cachePolicy: CachePolicy = CachePolicy.NetworkFirst
    ): Result<T> = try {
        val response = apolloClient.query(query)
            .variables(variables)
            .cachePolicy(cachePolicy)
            .addHttpHeader("X-Request-ID", generateRequestId())
            .execute()

        if (response.hasErrors()) {
            Result.failure(ApolloException(response.errors?.firstOrNull()?.message ?: "Unknown error"))
        } else {
            Result.success(response.data!!)
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    /**
     * Executes a GraphQL mutation with optimistic updates.
     *
     * @param T Generic type parameter for mutation response
     * @param mutation GraphQL mutation operation
     * @param variables Mutation variables map
     * @param optimisticUpdate Optional optimistic response
     * @return Mutation response
     */
    suspend fun <T : Mutation.Data> executeMutation(
        mutation: Mutation<T>,
        variables: Map<String, Any> = emptyMap(),
        optimisticUpdate: T? = null
    ): Result<T> = try {
        val response = apolloClient.mutation(mutation)
            .variables(variables)
            .apply {
                optimisticUpdate?.let { optimisticResponse(it) }
            }
            .addHttpHeader("X-Request-ID", generateRequestId())
            .execute()

        if (response.hasErrors()) {
            Result.failure(ApolloException(response.errors?.firstOrNull()?.message ?: "Unknown error"))
        } else {
            Result.success(response.data!!)
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    /**
     * Establishes a GraphQL subscription with automatic reconnection.
     *
     * @param T Generic type parameter for subscription updates
     * @param subscription GraphQL subscription operation
     * @param variables Subscription variables map
     * @return Flow of subscription updates with connection state
     */
    suspend fun <T : Subscription.Data> subscribeToUpdates(
        subscription: Subscription<T>,
        variables: Map<String, Any> = emptyMap()
    ): Flow<T> = flow {
        apolloClient.subscription(subscription)
            .variables(variables)
            .toFlow()
            .retryWhen { cause, attempt ->
                if (attempt < MAX_RETRY_ATTEMPTS && cause is ApolloException) {
                    _connectionState.value = ConnectionState.Reconnecting
                    delay(RETRY_DELAY_MS * (attempt + 1))
                    true
                } else {
                    _connectionState.value = ConnectionState.Error(cause)
                    false
                }
            }
            .collect { response ->
                if (response.hasErrors()) {
                    throw ApolloException(response.errors?.firstOrNull()?.message ?: "Unknown error")
                }
                _connectionState.value = ConnectionState.Connected
                emit(response.data!!)
            }
    }.catch { e ->
        _connectionState.value = ConnectionState.Error(e)
        throw e
    }

    private fun buildHttpClient(): OkHttpClient {
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        return OkHttpClient.Builder()
            .connectTimeout(API_CONFIG.TIMEOUT_MS, TimeUnit.MILLISECONDS)
            .readTimeout(API_CONFIG.TIMEOUT_MS, TimeUnit.MILLISECONDS)
            .writeTimeout(API_CONFIG.TIMEOUT_MS, TimeUnit.MILLISECONDS)
            .addInterceptor(loggingInterceptor)
            .addInterceptor { chain ->
                chain.proceed(
                    chain.request().newBuilder()
                        .addHeader("Accept", "application/json")
                        .addHeader("Content-Type", "application/json")
                        .build()
                )
            }
            .build()
    }

    private fun buildApolloClient(): ApolloClient {
        return ApolloClient.Builder()
            .serverUrl("${API_CONFIG.BASE_URL}/graphql")
            .webSocketServerUrl("${API_CONFIG.BASE_URL}/graphql/ws")
            .okHttpClient(httpClient)
            .webSocketNetworkTransport(
                WebSocketNetworkTransport.Builder()
                    .pingInterval(WEBSOCKET_PING_INTERVAL_MS)
                    .connectionTimeout(API_CONFIG.TIMEOUT_MS)
                    .build()
            )
            .normalizedCache(
                MemoryCacheFactory(maxSizeBytes = CACHE_SIZE_BYTES),
                cacheKeyGenerator = TypePolicyCacheKeyGenerator
            )
            .build()
    }

    private fun generateRequestId(): String = 
        "${System.currentTimeMillis()}-${java.util.UUID.randomUUID()}"

    sealed class ConnectionState {
        object Connected : ConnectionState()
        object Disconnected : ConnectionState()
        object Reconnecting : ConnectionState()
        data class Error(val throwable: Throwable) : ConnectionState()
    }

    companion object {
        private const val MAX_RETRY_ATTEMPTS = 3
        private const val RETRY_DELAY_MS = 1000L
        private const val WEBSOCKET_PING_INTERVAL_MS = 30000L
        private const val CACHE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
    }
}