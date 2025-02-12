import Foundation // latest
import os.log // latest

/// Defines logging categories for better organization and filtering of log messages
@objc public enum LogCategory: String {
    case network
    case sensor
    case analytics
    case security
    case general
    case performance
    case database
    case bluetooth
}

/// Structured log entry for internal processing
private struct LogEntry {
    let timestamp: Date
    let level: AppConstants.LogLevel
    let category: LogCategory
    let message: String
    let metadata: [String: Any]?
    let file: String?
    let function: String?
    let line: Int?
}

/// A comprehensive logging utility providing thread-safe, structured logging capabilities
/// with multiple severity levels, contextual information, and environment-specific configurations.
@objc public class Logger {
    
    // MARK: - Properties
    
    /// Shared singleton instance
    public static let shared = Logger()
    
    /// Thread-safe date formatter for ISO8601 timestamps
    private let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter
    }()
    
    /// Serial queue for thread-safe logging operations
    private let queue: DispatchQueue
    
    /// Buffer for batch processing of logs
    private var logBuffer: [LogEntry]
    
    /// Maximum size of the log buffer before forced flush
    private let maxBufferSize: Int = 1000
    
    /// System logger integration
    private var systemLogger: OSLog?
    
    // MARK: - Initialization
    
    private init() {
        self.queue = DispatchQueue(label: "com.smartapparel.logger", qos: .utility)
        self.logBuffer = []
        
        // Initialize system logger if available
        if #available(iOS 14.0, *) {
            self.systemLogger = OSLog(subsystem: AppConstants.APP_CONFIG.BUNDLE_ID, category: "SmartApparel")
        }
    }
    
    // MARK: - Public Methods
    
    /// Main logging function with comprehensive formatting and routing capabilities
    /// - Parameters:
    ///   - message: The log message
    ///   - level: Severity level of the log
    ///   - category: Category for log organization
    ///   - file: Source file generating the log
    ///   - function: Function generating the log
    ///   - line: Line number in source file
    ///   - metadata: Additional contextual information
    @discardableResult
    public func log(
        _ message: String,
        level: AppConstants.LogLevel,
        category: LogCategory,
        file: String? = #file,
        function: String? = #function,
        line: Int? = #line,
        metadata: [String: Any]? = nil
    ) {
        // Check if log level meets minimum threshold
        guard level.rawValue >= AppConstants.APP_CONFIG.LOG_LEVEL.rawValue else { return }
        
        queue.async { [weak self] in
            guard let self = self else { return }
            
            let entry = LogEntry(
                timestamp: Date(),
                level: level,
                category: category,
                message: message,
                metadata: metadata,
                file: file.map { ($0 as NSString).lastPathComponent },
                function: function,
                line: line
            )
            
            // Format log entry
            let formattedMessage = self.formatLogEntry(entry)
            
            // Forward to system logger in production
            if AppConstants.APP_CONFIG.ENVIRONMENT == .production {
                self.forwardToSystemLogger(entry)
            }
            
            // Buffer log entry
            self.logBuffer.append(entry)
            
            // Flush buffer if needed
            if self.logBuffer.count >= self.maxBufferSize {
                self.flushLogBuffer()
            }
            
            // Print to console in development
            if AppConstants.APP_CONFIG.ENVIRONMENT == .development {
                print(formattedMessage)
            }
        }
    }
    
    /// Enhanced error logging with stack trace and context capture
    /// - Parameters:
    ///   - message: Error message
    ///   - category: Log category
    ///   - error: Optional Error object
    ///   - metadata: Additional context
    public func error(
        _ message: String,
        category: LogCategory,
        error: Error? = nil,
        metadata: [String: Any]? = nil
    ) {
        var enhancedMetadata = metadata ?? [:]
        
        if let error = error {
            enhancedMetadata["error"] = error.localizedDescription
            enhancedMetadata["errorDomain"] = (error as NSError).domain
            enhancedMetadata["errorCode"] = (error as NSError).code
            
            // Capture stack trace in development
            if AppConstants.APP_CONFIG.ENVIRONMENT == .development {
                enhancedMetadata["stackTrace"] = Thread.callStackSymbols
            }
        }
        
        // Add system state information
        enhancedMetadata["memoryUsage"] = getMemoryUsage()
        enhancedMetadata["diskSpace"] = getDiskSpace()
        
        log(
            message,
            level: .error,
            category: category,
            metadata: enhancedMetadata
        )
    }
    
    /// Comprehensive logger configuration with environment settings
    /// - Parameters:
    ///   - minimumLogLevel: Minimum log level to process
    ///   - config: Additional configuration options
    public func configure(
        minimumLogLevel: AppConstants.LogLevel,
        config: [String: Any] = [:]
    ) {
        queue.async { [weak self] in
            guard let self = self else { return }
            
            // Update system logger if needed
            if #available(iOS 14.0, *) {
                self.systemLogger = OSLog(subsystem: AppConstants.APP_CONFIG.BUNDLE_ID, category: "SmartApparel")
            }
            
            // Flush existing buffer
            self.flushLogBuffer()
        }
    }
    
    // MARK: - Private Methods
    
    private func formatLogEntry(_ entry: LogEntry) -> String {
        let timestamp = dateFormatter.string(from: entry.timestamp)
        let level = String(describing: entry.level).uppercased()
        let category = entry.category.rawValue.uppercased()
        
        var contextInfo = ""
        if let file = entry.file, let line = entry.line {
            contextInfo = "[\(file):\(line)]"
        }
        
        var metadataString = ""
        if let metadata = entry.metadata {
            metadataString = "metadata: \(metadata)"
        }
        
        return "[\(timestamp)] [\(level)] [\(category)] \(contextInfo) \(entry.message) \(metadataString)"
    }
    
    private func forwardToSystemLogger(_ entry: LogEntry) {
        guard let systemLogger = systemLogger else { return }
        
        if #available(iOS 14.0, *) {
            let type: OSLogType
            switch entry.level {
            case .debug: type = .debug
            case .info: type = .info
            case .warning: type = .error
            case .error: type = .fault
            }
            
            os_log(
                .init(stringLiteral: entry.message),
                log: systemLogger,
                type: type,
                "%{public}@",
                formatLogEntry(entry)
            )
        }
    }
    
    private func flushLogBuffer() {
        // Implement log persistence or forwarding logic here
        logBuffer.removeAll()
    }
    
    private func getMemoryUsage() -> UInt64 {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4
        
        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }
        
        return kerr == KERN_SUCCESS ? info.resident_size : 0
    }
    
    private func getDiskSpace() -> Int64 {
        let fileManager = FileManager.default
        guard let systemAttributes = try? fileManager.attributesOfFileSystem(forPath: NSHomeDirectory()) else {
            return 0
        }
        return (systemAttributes[.systemFreeSize] as? NSNumber)?.int64Value ?? 0
    }
}