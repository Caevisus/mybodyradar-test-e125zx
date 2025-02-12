import Foundation // latest
import CryptoKit // latest

/// Thread-safe service managing local data persistence and caching with encryption and backup capabilities
@objc public final class LocalStorageService {
    
    // MARK: - Storage Keys
    
    private enum StorageKey: String {
        case userPreferences
        case sessionData
        case sensorCalibration
        case alerts
        case backups
    }
    
    // MARK: - Constants
    
    private let MAX_CACHE_SIZE = 1024 * 1024 * 1024 // 1GB as per spec
    private let RETENTION_PERIOD: TimeInterval = 30 * 24 * 60 * 60 // 30 days
    private let ENCRYPTION_KEY_SIZE = 32 // 256 bits for AES-256
    private let COMPRESSION_RATIO = 10 // 10:1 compression ratio
    
    // MARK: - Properties
    
    /// Shared singleton instance
    public static let shared = LocalStorageService()
    
    private let userDefaults: UserDefaults
    private let fileManager: FileManager
    private let cacheQueue: DispatchQueue
    private let storageQueue: DispatchQueue
    private var cacheIndex: [String: CacheMetadata]
    private let logger = Logger.shared
    
    // MARK: - Private Types
    
    private struct CacheMetadata: Codable {
        let key: String
        let size: Int
        let timestamp: Date
        let isEncrypted: Bool
        let checksum: String
        var accessCount: Int
        var lastAccess: Date
    }
    
    private enum StorageError: Error {
        case invalidData
        case encryptionError
        case compressionError
        case storageLimitExceeded
        case itemNotFound
        case invalidMetadata
        case securityError
    }
    
    // MARK: - Initialization
    
    private init() {
        userDefaults = UserDefaults.standard
        fileManager = FileManager.default
        cacheQueue = DispatchQueue(label: "com.smartapparel.storage.cache", qos: .utility)
        storageQueue = DispatchQueue(label: "com.smartapparel.storage.persistent", qos: .utility)
        cacheIndex = [:]
        
        setupSecureStorage()
        loadCacheIndex()
        performInitialMaintenance()
    }
    
    // MARK: - Public Methods
    
    /// Securely saves data to local storage with encryption and compression
    public func saveData(_ data: Any, 
                        forKey key: String, 
                        encrypt: Bool = true) -> Result<Void, StorageError> {
        return cacheQueue.sync {
            do {
                // Validate and serialize data
                guard let jsonData = try? JSONSerialization.data(withJSONObject: data) else {
                    logger.error("Data serialization failed", category: .database)
                    return .failure(.invalidData)
                }
                
                // Check size limits
                guard jsonData.count <= MAX_CACHE_SIZE else {
                    logger.error("Storage limit exceeded", category: .database)
                    return .failure(.storageLimitExceeded)
                }
                
                // Compress data
                let compressed = try compressData(jsonData)
                
                // Encrypt if required
                let finalData = encrypt ? try encryptData(compressed) : compressed
                
                // Generate metadata
                let metadata = CacheMetadata(
                    key: key,
                    size: finalData.count,
                    timestamp: Date(),
                    isEncrypted: encrypt,
                    checksum: generateChecksum(finalData),
                    accessCount: 0,
                    lastAccess: Date()
                )
                
                // Save data and update cache index
                try saveToStorage(finalData, withKey: key)
                cacheIndex[key] = metadata
                
                logger.debug("Data saved successfully for key: \(key)", category: .database)
                return .success(())
            } catch {
                logger.error("Failed to save data", category: .database, error: error)
                return .failure(.storageLimitExceeded)
            }
        }
    }
    
    /// Retrieves and decrypts data from local storage
    public func getData(forKey key: String, 
                       decrypt: Bool = true) -> Result<Any?, StorageError> {
        return cacheQueue.sync {
            do {
                // Check if data exists
                guard let metadata = cacheIndex[key] else {
                    return .success(nil)
                }
                
                // Read data from storage
                guard let data = try? loadFromStorage(key) else {
                    return .failure(.itemNotFound)
                }
                
                // Verify data integrity
                guard generateChecksum(data) == metadata.checksum else {
                    logger.error("Data integrity check failed", category: .database)
                    return .failure(.securityError)
                }
                
                // Decrypt if necessary
                let decryptedData = metadata.isEncrypted && decrypt ? 
                    try decryptData(data) : data
                
                // Decompress data
                let decompressed = try decompressData(decryptedData)
                
                // Parse JSON data
                guard let result = try? JSONSerialization.jsonObject(with: decompressed) else {
                    return .failure(.invalidData)
                }
                
                // Update access metadata
                updateAccessMetadata(forKey: key)
                
                logger.debug("Data retrieved successfully for key: \(key)", category: .database)
                return .success(result)
            } catch {
                logger.error("Failed to retrieve data", category: .database, error: error)
                return .failure(.invalidData)
            }
        }
    }
    
    /// Performs storage maintenance and cleanup
    public func performMaintenance() -> Result<Void, StorageError> {
        return storageQueue.sync {
            do {
                // Remove expired items
                let now = Date()
                let expiredKeys = cacheIndex.filter { 
                    now.timeIntervalSince($0.value.timestamp) > RETENTION_PERIOD 
                }.map { $0.key }
                
                for key in expiredKeys {
                    try? removeFromStorage(key)
                    cacheIndex.removeValue(forKey: key)
                }
                
                // Enforce storage limits
                var totalSize = cacheIndex.values.reduce(0) { $0 + $1.size }
                while totalSize > MAX_CACHE_SIZE {
                    guard let oldestKey = findOldestAccessedKey() else { break }
                    try? removeFromStorage(oldestKey)
                    if let size = cacheIndex[oldestKey]?.size {
                        totalSize -= size
                    }
                    cacheIndex.removeValue(forKey: oldestKey)
                }
                
                // Save updated cache index
                try saveCacheIndex()
                
                logger.debug("Maintenance completed successfully", category: .database)
                return .success(())
            } catch {
                logger.error("Maintenance failed", category: .database, error: error)
                return .failure(.invalidMetadata)
            }
        }
    }
    
    // MARK: - Private Methods
    
    private func setupSecureStorage() {
        let secureDirectory = getSecureStorageDirectory()
        if !fileManager.fileExists(atPath: secureDirectory.path) {
            try? fileManager.createDirectory(at: secureDirectory, 
                                          withIntermediateDirectories: true)
        }
    }
    
    private func getSecureStorageDirectory() -> URL {
        let appSupport = fileManager.urls(for: .applicationSupportDirectory, 
                                        in: .userDomainMask).first!
        return appSupport.appendingPathComponent("SecureStorage")
    }
    
    private func compressData(_ data: Data) throws -> Data {
        // Implement compression to achieve 10:1 ratio
        // This is a placeholder for actual compression implementation
        return data
    }
    
    private func decompressData(_ data: Data) throws -> Data {
        // Implement decompression
        // This is a placeholder for actual decompression implementation
        return data
    }
    
    private func encryptData(_ data: Data) throws -> Data {
        let key = SymmetricKey(size: .bits256)
        let nonce = try AES.GCM.Nonce()
        let sealedBox = try AES.GCM.seal(data, using: key, nonce: nonce)
        return sealedBox.combined ?? Data()
    }
    
    private func decryptData(_ data: Data) throws -> Data {
        let key = SymmetricKey(size: .bits256)
        let sealedBox = try AES.GCM.SealedBox(combined: data)
        return try AES.GCM.open(sealedBox, using: key)
    }
    
    private func generateChecksum(_ data: Data) -> String {
        let hash = SHA256.hash(data: data)
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }
    
    private func saveToStorage(_ data: Data, withKey key: String) throws {
        let fileURL = getSecureStorageDirectory().appendingPathComponent(key)
        try data.write(to: fileURL, options: .atomicWrite)
    }
    
    private func loadFromStorage(_ key: String) throws -> Data {
        let fileURL = getSecureStorageDirectory().appendingPathComponent(key)
        return try Data(contentsOf: fileURL)
    }
    
    private func removeFromStorage(_ key: String) throws {
        let fileURL = getSecureStorageDirectory().appendingPathComponent(key)
        try fileManager.removeItem(at: fileURL)
    }
    
    private func loadCacheIndex() {
        if let data = userDefaults.data(forKey: "cacheIndex"),
           let decoded = try? JSONDecoder().decode([String: CacheMetadata].self, from: data) {
            cacheIndex = decoded
        }
    }
    
    private func saveCacheIndex() throws {
        let data = try JSONEncoder().encode(cacheIndex)
        userDefaults.set(data, forKey: "cacheIndex")
    }
    
    private func updateAccessMetadata(forKey key: String) {
        if var metadata = cacheIndex[key] {
            metadata.accessCount += 1
            metadata.lastAccess = Date()
            cacheIndex[key] = metadata
        }
    }
    
    private func findOldestAccessedKey() -> String? {
        return cacheIndex.min { $0.value.lastAccess < $1.value.lastAccess }?.key
    }
    
    private func performInitialMaintenance() {
        _ = performMaintenance()
    }
}