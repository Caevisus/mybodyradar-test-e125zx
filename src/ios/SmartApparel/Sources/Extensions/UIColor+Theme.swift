import UIKit // latest
import AppConstants // internal

// MARK: - UIColor Theme Extension
public extension UIColor {
    
    /// Creates a dynamic color that adapts to light and dark mode
    /// - Parameters:
    ///   - light: Color for light mode
    ///   - dark: Color for dark mode
    /// - Returns: Dynamic UIColor instance
    private static func dynamicColor(light: UIColor, dark: UIColor) -> UIColor {
        return UIColor { traitCollection in
            return traitCollection.userInterfaceStyle == .dark ? dark : light
        }
    }
    
    // MARK: - Material Design 3.0 System Colors
    
    /// Primary brand color for key components
    static let primary = dynamicColor(
        light: UIColor(hex: 0x007AFF),
        dark: UIColor(hex: 0x0A84FF)
    )
    
    /// Secondary color for less prominent components
    static let secondary = dynamicColor(
        light: UIColor(hex: 0x5856D6),
        dark: UIColor(hex: 0x5E5CE6)
    )
    
    /// Accent color for floating action buttons and interactive elements
    static let accent = dynamicColor(
        light: UIColor(hex: 0xFF2D55),
        dark: UIColor(hex: 0xFF375F)
    )
    
    /// Background color for screens and components
    static let background = dynamicColor(
        light: UIColor(hex: 0xF2F2F7),
        dark: UIColor(hex: 0x000000)
    )
    
    /// Surface color for cards, sheets, and menus
    static let surface = dynamicColor(
        light: UIColor(hex: 0xFFFFFF),
        dark: UIColor(hex: 0x1C1C1E)
    )
    
    /// Color for error states and destructive actions
    static let error = dynamicColor(
        light: UIColor(hex: 0xFF3B30),
        dark: UIColor(hex: 0xFF453A)
    )
    
    /// Color for warning states and cautionary actions
    static let warning = dynamicColor(
        light: UIColor(hex: 0xFF9500),
        dark: UIColor(hex: 0xFF9F0A)
    )
    
    /// Color for success states and positive actions
    static let success = dynamicColor(
        light: UIColor(hex: 0x34C759),
        dark: UIColor(hex: 0x30D158)
    )
    
    /// Primary text color
    static let text = dynamicColor(
        light: UIColor(hex: 0x000000),
        dark: UIColor(hex: 0xFFFFFF)
    )
    
    /// Secondary text color for less prominent text
    static let textSecondary = dynamicColor(
        light: UIColor(hex: 0x8E8E93),
        dark: UIColor(hex: 0x98989D)
    )
    
    /// Border color for dividers and strokes
    static let border = dynamicColor(
        light: UIColor(hex: 0xC6C6C8),
        dark: UIColor(hex: 0x38383A)
    )
    
    /// Shadow color with dynamic opacity
    static let shadow = dynamicColor(
        light: UIColor.black.withAlphaComponent(0.2),
        dark: UIColor.black.withAlphaComponent(0.3)
    )
    
    // MARK: - Data Visualization Colors
    
    /// Color gradient for heat map visualization
    static let heatMapGradient: [UIColor] = [
        .systemBlue,
        .systemGreen,
        .systemYellow,
        .systemRed
    ]
    
    /// Colors for charts and graphs
    static let chartColors: [UIColor] = [
        .systemBlue,
        .systemGreen,
        .systemOrange,
        .systemPink,
        .systemPurple
    ]
    
    // MARK: - Team Theming Colors
    
    /// Primary team color with dynamic adaptation
    static var teamPrimary: UIColor {
        get {
            return UserDefaults.standard.color(forKey: "teamPrimaryColor") ?? primary
        }
        set {
            UserDefaults.standard.set(newValue, forKey: "teamPrimaryColor")
        }
    }
    
    /// Secondary team color with dynamic adaptation
    static var teamSecondary: UIColor {
        get {
            return UserDefaults.standard.color(forKey: "teamSecondaryColor") ?? secondary
        }
        set {
            UserDefaults.standard.set(newValue, forKey: "teamSecondaryColor")
        }
    }
}

// MARK: - UIColor Hex Initializer
private extension UIColor {
    /// Initialize color with hex value
    /// - Parameter hex: Hex color value
    convenience init(hex: Int) {
        let red = CGFloat((hex >> 16) & 0xFF) / 255.0
        let green = CGFloat((hex >> 8) & 0xFF) / 255.0
        let blue = CGFloat(hex & 0xFF) / 255.0
        self.init(red: red, green: green, blue: blue, alpha: 1.0)
    }
}

// MARK: - UserDefaults Color Extension
private extension UserDefaults {
    /// Get color from UserDefaults
    func color(forKey key: String) -> UIColor? {
        guard let colorData = data(forKey: key) else { return nil }
        return try? NSKeyedUnarchiver.unarchivedObject(ofClass: UIColor.self, from: colorData)
    }
    
    /// Set color in UserDefaults
    func set(_ color: UIColor?, forKey key: String) {
        guard let color = color,
              let colorData = try? NSKeyedArchiver.archivedData(withRootObject: color, requiringSecureCoding: true)
        else { return }
        set(colorData, forKey: key)
    }
}