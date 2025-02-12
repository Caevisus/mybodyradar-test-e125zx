import Foundation // latest
import LocalAuthentication // latest
import Security // latest
import CryptoKit // latest

/// Global constants for security configuration
private let kKeychainService = "com.smartapparel.ios"
private let kEncryptionKey = "com.smartapparel.ios.encryption"
private let kMaxAuthAttempts = 3
private let kAuthTimeout = 30.0

/// Comprehensive security utility providing encryption, authentication, and secure storage operations
public struct SecurityUtils {
    
    // MARK: - Error Types
    
    /// Enumeration of possible security-related errors
    public enum SecurityError: Error {
        case authenticationFailed
        case biometricsNotAvailable
        case deviceNotSecure
        case jailbreakDetected
        case maxAttemptsExceeded
        case encryptionFailed
        case decryptionFailed
        case invalidKeyData
        case keychainError
        case dataCorrupted
        case timeout
    }
    
    /// Security access levels for keychain items
    public enum SecurityAccessLevel {
        case afterFirstUnlock
        case afterFirstUnlockThisDeviceOnly
        case whenUnlocked
        case whenUnlockedThisDeviceOnly
        case whenPasscodeSetThisDeviceOnly
        
        var secAccessControl: SecAccessControl? {
            var access: SecAccessControl?
            var protection: SecAccessControlCreateFlags
            
            switch self {
            case .afterFirstUnlock:
                protection = .afterFirstUnlock
            case .afterFirstUnlockThisDeviceOnly:
                protection = [.afterFirstUnlock, .thisDeviceOnly]
            case .whenUnlocked:
                protection = .whenUnlocked
            case .whenUnlockedThisDeviceOnly:
                protection = [.whenUnlocked, .thisDeviceOnly]
            case .whenPasscodeSetThisDeviceOnly:
                protection = [.whenPasscodeSet, .thisDeviceOnly]
            }
            
            access = try? SecAccessControlCreateWithFlags(
                kCFAllocatorDefault,
                kSecAttrAccessibleWhenUnlocked,
                protection,
                nil
            )
            
            return access
        }
    }
    
    // MARK: - Private Properties
    
    private static var authenticationAttempts = 0
    private static let authQueue = DispatchQueue(label: "com.smartapparel.security.auth")
    
    // MARK: - Biometric Authentication
    
    /// Authenticates user using device biometrics with enhanced security validations
    /// - Parameters:
    ///   - reason: Localized reason string for authentication
    ///   - completion: Completion handler with authentication result
    @available(iOS 14.0, *)
    public static func authenticateWithBiometrics(
        reason: String,
        completion: @escaping (Result<Void, SecurityError>) -> Void
    ) {
        // Verify device security
        guard !isJailbroken() else {
            completion(.failure(.jailbreakDetected))
            return
        }
        
        guard isDeviceSecure() else {
            completion(.failure(.deviceNotSecure))
            return
        }
        
        // Check authentication attempts
        guard authenticationAttempts < AppConstants.SESSION_CONFIG.MAX_FAILED_AUTH_ATTEMPTS else {
            completion(.failure(.maxAttemptsExceeded))
            return
        }
        
        let context = LAContext()
        var error: NSError?
        
        // Verify biometric availability
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            completion(.failure(.biometricsNotAvailable))
            return
        }
        
        // Configure authentication context
        context.localizedCancelTitle = "Cancel"
        context.localizedFallbackTitle = "Use Passcode"
        
        // Perform authentication with timeout
        authQueue.async {
            let authenticationTimer = DispatchSource.makeTimerSource(queue: authQueue)
            authenticationTimer.schedule(deadline: .now() + kAuthTimeout)
            
            authenticationTimer.setEventHandler {
                context.invalidate()
                completion(.failure(.timeout))
            }
            
            authenticationTimer.resume()
            
            context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            ) { success, error in
                authenticationTimer.cancel()
                
                DispatchQueue.main.async {
                    if success {
                        authenticationAttempts = 0
                        completion(.success(()))
                    } else {
                        authenticationAttempts += 1
                        completion(.failure(.authenticationFailed))
                    }
                }
            }
        }
    }
    
    // MARK: - Secure Storage
    
    /// Stores sensitive data securely in keychain with enhanced encryption
    /// - Parameters:
    ///   - data: Data to be stored
    ///   - key: Unique identifier for the stored data
    ///   - accessLevel: Security access level for the stored data
    /// - Returns: Result indicating success or detailed error
    public static func storeSecureItem(
        data: Data,
        key: String,
        accessLevel: SecurityAccessLevel
    ) -> Result<Void, SecurityError> {
        // Generate random salt
        guard let salt = generateRandomBytes(length: 32) else {
            return .failure(.encryptionFailed)
        }
        
        // Encrypt data
        let encryptionResult = encryptData(data: data, context: EncryptionContext(salt: salt))
        
        switch encryptionResult {
        case .success(let encryptedData):
            // Prepare keychain query
            var query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: kKeychainService,
                kSecAttrAccount as String: key,
                kSecValueData as String: encryptedData.concatenatedData
            ]
            
            // Add access control
            if let accessControl = accessLevel.secAccessControl {
                query[kSecAttrAccessControl as String] = accessControl
            }
            
            // Attempt to store in keychain
            let status = SecItemAdd(query as CFDictionary, nil)
            
            if status == errSecDuplicateItem {
                // Update existing item
                let updateQuery = [
                    kSecClass as String: kSecClassGenericPassword,
                    kSecAttrService as String: kKeychainService,
                    kSecAttrAccount as String: key
                ]
                
                let updateAttributes = [
                    kSecValueData as String: encryptedData.concatenatedData
                ]
                
                let updateStatus = SecItemUpdate(
                    updateQuery as CFDictionary,
                    updateAttributes as CFDictionary
                )
                
                guard updateStatus == errSecSuccess else {
                    return .failure(.keychainError)
                }
            } else if status != errSecSuccess {
                return .failure(.keychainError)
            }
            
            return .success(())
            
        case .failure(let error):
            return .failure(error)
        }
    }
    
    /// Retrieves and decrypts sensitive data from keychain
    /// - Parameter key: Unique identifier for the stored data
    /// - Returns: Result containing decrypted data or detailed error
    public static func retrieveSecureItem(key: String) -> Result<Data, SecurityError> {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: kKeychainService,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess,
              let encryptedData = result as? Data else {
            return .failure(.keychainError)
        }
        
        // Extract salt and encrypted data
        guard encryptedData.count > 32 else {
            return .failure(.dataCorrupted)
        }
        
        let salt = encryptedData.prefix(32)
        let remainingData = encryptedData.dropFirst(32)
        
        // Decrypt data
        let context = EncryptionContext(salt: Data(salt))
        return decryptData(encryptedData: EncryptedData(concatenatedData: remainingData), context: context)
    }
    
    // MARK: - Encryption
    
    /// Represents the context for encryption operations
    private struct EncryptionContext {
        let salt: Data
        let iterations: Int = 10000
        let keyLength: Int = 32
    }
    
    /// Contains encrypted data and associated metadata
    private struct EncryptedData {
        let concatenatedData: Data
        
        init(concatenatedData: Data) {
            self.concatenatedData = concatenatedData
        }
    }
    
    /// Encrypts data using AES-256-GCM with secure key derivation
    /// - Parameters:
    ///   - data: Data to be encrypted
    ///   - context: Encryption context containing salt and parameters
    /// - Returns: Result containing encrypted data package or detailed error
    private static func encryptData(
        data: Data,
        context: EncryptionContext
    ) -> Result<EncryptedData, SecurityError> {
        // Derive encryption key
        guard let key = deriveKey(salt: context.salt, iterations: context.iterations) else {
            return .failure(.encryptionFailed)
        }
        
        do {
            let symmetricKey = SymmetricKey(data: key)
            let nonce = try AES.GCM.Nonce()
            let sealedBox = try AES.GCM.seal(data, using: symmetricKey, nonce: nonce)
            
            guard let concatenatedData = sealedBox.combined else {
                return .failure(.encryptionFailed)
            }
            
            // Combine salt with encrypted data
            var finalData = Data()
            finalData.append(context.salt)
            finalData.append(concatenatedData)
            
            return .success(EncryptedData(concatenatedData: finalData))
        } catch {
            return .failure(.encryptionFailed)
        }
    }
    
    /// Decrypts data using AES-256-GCM
    /// - Parameters:
    ///   - encryptedData: Encrypted data package
    ///   - context: Encryption context containing salt and parameters
    /// - Returns: Result containing decrypted data or detailed error
    private static func decryptData(
        encryptedData: EncryptedData,
        context: EncryptionContext
    ) -> Result<Data, SecurityError> {
        // Derive decryption key
        guard let key = deriveKey(salt: context.salt, iterations: context.iterations) else {
            return .failure(.decryptionFailed)
        }
        
        do {
            let symmetricKey = SymmetricKey(data: key)
            let sealedBox = try AES.GCM.SealedBox(combined: encryptedData.concatenatedData)
            let decryptedData = try AES.GCM.open(sealedBox, using: symmetricKey)
            return .success(decryptedData)
        } catch {
            return .failure(.decryptionFailed)
        }
    }
    
    // MARK: - Helper Functions
    
    /// Generates cryptographically secure random bytes
    /// - Parameter length: Number of random bytes to generate
    /// - Returns: Data containing random bytes or nil if generation fails
    private static func generateRandomBytes(length: Int) -> Data? {
        var bytes = [UInt8](repeating: 0, count: length)
        let status = SecRandomCopyBytes(kSecRandomDefault, length, &bytes)
        return status == errSecSuccess ? Data(bytes) : nil
    }
    
    /// Derives encryption key using PBKDF2
    /// - Parameters:
    ///   - salt: Salt for key derivation
    ///   - iterations: Number of iterations for key derivation
    /// - Returns: Derived key data or nil if derivation fails
    private static func deriveKey(salt: Data, iterations: Int) -> Data? {
        guard let keyData = kEncryptionKey.data(using: .utf8) else {
            return nil
        }
        
        var derivedKeyData = Data(count: 32)
        let derivationStatus = derivedKeyData.withUnsafeMutableBytes { derivedKeyBytes in
            keyData.withUnsafeBytes { keyBytes in
                salt.withUnsafeBytes { saltBytes in
                    CCKeyDerivationPBKDF(
                        CCPBKDFAlgorithm(kCCPBKDF2),
                        keyBytes.baseAddress?.assumingMemoryBound(to: Int8.self),
                        keyData.count,
                        saltBytes.baseAddress?.assumingMemoryBound(to: UInt8.self),
                        salt.count,
                        CCPBKDFAlgorithm(kCCPRFHmacAlgSHA256),
                        UInt32(iterations),
                        derivedKeyBytes.baseAddress?.assumingMemoryBound(to: UInt8.self),
                        32
                    )
                }
            }
        }
        
        return derivationStatus == kCCSuccess ? derivedKeyData : nil
    }
    
    /// Checks if the device is jailbroken
    /// - Returns: Boolean indicating if jailbreak is detected
    private static func isJailbroken() -> Bool {
        #if targetEnvironment(simulator)
        return false
        #else
        let paths = [
            "/Applications/Cydia.app",
            "/Library/MobileSubstrate/MobileSubstrate.dylib",
            "/bin/bash",
            "/usr/sbin/sshd",
            "/etc/apt",
            "/private/var/lib/apt/"
        ]
        
        for path in paths {
            if FileManager.default.fileExists(atPath: path) {
                return true
            }
        }
        
        return false
        #endif
    }
    
    /// Verifies device security settings
    /// - Returns: Boolean indicating if device meets security requirements
    private static func isDeviceSecure() -> Bool {
        let context = LAContext()
        var error: NSError?
        
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            return false
        }
        
        return true
    }
}