import Foundation // latest

/// Defines the available date formatting styles for the application
public enum DateFormatStyle {
    /// ISO8601 format with millisecond precision for API communication
    case iso8601
    /// Short date format (e.g., "MM/dd/yy")
    case shortDate
    /// Long date format (e.g., "MMMM d, yyyy")
    case longDate
    /// Time format (e.g., "HH:mm:ss")
    case time
    /// Combined date and time format
    case dateTime
    /// Relative time format (e.g., "2 hours ago")
    case relative
}

/// Thread-safe cache for DateFormatter instances
private let dateFormatterCache = NSCache<NSString, DateFormatter>()
private let iso8601FormatterCache = NSCache<NSString, ISO8601DateFormatter>()
private let relativeDateFormatterCache = NSCache<NSString, RelativeDateTimeFormatter>()

/// Extension providing comprehensive date formatting capabilities for the Smart Apparel application
public extension Date {
    
    /// Converts date to string using specified format style with caching and thread safety
    /// - Parameter style: The desired format style for the output string
    /// - Returns: Formatted date string according to the specified style
    func toString(style: DateFormatStyle) -> String {
        switch style {
        case .iso8601:
            return toISO8601String()
        case .relative:
            return toRelativeString()
        default:
            let cacheKey = NSString(string: style.description)
            
            if let cachedFormatter = dateFormatterCache.object(forKey: cacheKey) {
                return cachedFormatter.string(from: self)
            }
            
            let formatter = DateFormatter()
            formatter.locale = Locale.current
            formatter.calendar = Calendar.current
            formatter.timeZone = TimeZone.current
            
            switch style {
            case .shortDate:
                formatter.dateStyle = .short
                formatter.timeStyle = .none
            case .longDate:
                formatter.dateStyle = .long
                formatter.timeStyle = .none
            case .time:
                formatter.dateStyle = .none
                formatter.timeStyle = .medium
            case .dateTime:
                formatter.dateStyle = .medium
                formatter.timeStyle = .medium
            default:
                break
            }
            
            dateFormatterCache.setObject(formatter, forKey: cacheKey)
            return formatter.string(from: self)
        }
    }
    
    /// Converts date to ISO8601 formatted string with millisecond precision for API communication
    /// - Returns: ISO8601 compliant date string with millisecond precision
    func toISO8601String() -> String {
        let cacheKey = "ISO8601" as NSString
        
        if let cachedFormatter = iso8601FormatterCache.object(forKey: cacheKey) {
            return cachedFormatter.string(from: self)
        }
        
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [
            .withInternetDateTime,
            .withFractionalSeconds,
            .withTimeZone
        ]
        
        iso8601FormatterCache.setObject(formatter, forKey: cacheKey)
        return formatter.string(from: self)
    }
    
    /// Generates human-readable relative time string with localization support
    /// - Returns: Localized relative time description (e.g., "2 hours ago")
    func toRelativeString() -> String {
        let cacheKey = "RelativeDate" as NSString
        
        if let cachedFormatter = relativeDateFormatterCache.object(forKey: cacheKey) {
            return cachedFormatter.localizedString(for: self, relativeTo: Date())
        }
        
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = Locale.current
        formatter.calendar = Calendar.current
        formatter.unitsStyle = .full
        formatter.dateTimeStyle = .named
        
        relativeDateFormatterCache.setObject(formatter, forKey: cacheKey)
        return formatter.localizedString(for: self, relativeTo: Date())
    }
    
    /// Formats date specifically for session timing display with performance optimization
    /// - Returns: Formatted time string in HH:mm:ss format
    func toSessionTimeString() -> String {
        let cacheKey = "SessionTime" as NSString
        
        if let cachedFormatter = dateFormatterCache.object(forKey: cacheKey) {
            return cachedFormatter.string(from: self)
        }
        
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        formatter.timeZone = TimeZone.current
        formatter.locale = Locale(identifier: "en_US_POSIX") // POSIX locale for consistent formatting
        
        // Configure formatter for optimal performance
        formatter.formatterBehavior = .behavior10_4
        formatter.doesRelativeDateFormatting = false
        
        dateFormatterCache.setObject(formatter, forKey: cacheKey)
        return formatter.string(from: self)
    }
}