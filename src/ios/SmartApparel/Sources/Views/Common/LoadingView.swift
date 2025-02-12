import UIKit // latest

/// A reusable loading view component that displays an activity indicator with optional text message,
/// implementing Material Design 3.0 elevation system and WCAG 2.1 Level AA accessibility compliance.
@IBDesignable
public final class LoadingView: UIView {
    
    // MARK: - Private Properties
    
    private let activityIndicator: UIActivityIndicatorView = {
        let indicator = UIActivityIndicatorView(style: .large)
        indicator.hidesWhenStopped = true
        return indicator
    }()
    
    private let messageLabel: UILabel = {
        let label = UILabel()
        label.textAlignment = .center
        label.numberOfLines = 0
        label.adjustsFontForContentSizeCategory = true
        label.font = .preferredFont(forTextStyle: .body)
        return label
    }()
    
    private let containerStack: UIStackView = {
        let stack = UIStackView()
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = AppConstants.UI_CONFIG.DEFAULT_PADDING
        return stack
    }()
    
    private let minimumTouchSize: CGFloat = AppConstants.UI_CONFIG.MINIMUM_TARGET_SIZE
    
    // MARK: - Public Properties
    
    /// Current loading message text
    public var message: String? {
        didSet {
            messageLabel.text = message
            updateAccessibility()
        }
    }
    
    /// Indicates if the loading animation is currently active
    public private(set) var isAnimating: Bool = false
    
    // MARK: - Initialization
    
    /// Initializes the loading view with an optional message
    /// - Parameter message: Optional text message to display below the activity indicator
    public init(message: String? = nil) {
        super.init(frame: .zero)
        self.message = message
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupUI()
    }
    
    // MARK: - Private Methods
    
    private func setupUI() {
        // Configure container stack
        addSubview(containerStack)
        containerStack.centerInSuperview()
        
        // Add and configure activity indicator
        containerStack.addArrangedSubview(activityIndicator)
        activityIndicator.constrainSize(CGSize(width: minimumTouchSize, height: minimumTouchSize))
        
        // Add and configure message label if needed
        containerStack.addArrangedSubview(messageLabel)
        messageLabel.text = message
        
        // Apply semantic colors
        backgroundColor = UIColor.background.withAlphaComponent(0.9)
        messageLabel.textColor = .text
        
        // Configure Material Design elevation
        layer.shadowColor = UIColor.shadow.cgColor
        layer.shadowOpacity = AppConstants.UI_CONFIG.SHADOW_OPACITY
        layer.shadowRadius = AppConstants.UI_CONFIG.SHADOW_RADIUS
        layer.shadowOffset = CGSize(width: 0, height: 2)
        
        // Configure accessibility
        isAccessibilityElement = true
        accessibilityTraits = .updatesFrequently
        updateAccessibility()
    }
    
    private func updateAccessibility() {
        let baseText = message ?? NSLocalizedString("Loading", comment: "Loading state description")
        accessibilityLabel = isAnimating ? 
            String(format: NSLocalizedString("%@, Loading in progress", comment: "Loading view accessibility label"), baseText) :
            baseText
        
        // Post accessibility announcement when message changes
        if let message = message {
            UIAccessibility.post(notification: .announcement, argument: message)
        }
    }
    
    // MARK: - Public Methods
    
    /// Starts the loading animation with accessibility announcement
    public func startAnimating() {
        guard !isAnimating else { return }
        
        isHidden = false
        activityIndicator.startAnimating()
        isAnimating = true
        
        // Animate appearance
        alpha = 0
        UIView.animate(withDuration: AppConstants.UI_CONFIG.ANIMATION_DURATION) {
            self.alpha = 1
        }
        
        updateAccessibility()
        UIAccessibility.post(notification: .layoutChanged, argument: self)
    }
    
    /// Stops the loading animation with accessibility announcement
    public func stopAnimating() {
        guard isAnimating else { return }
        
        // Animate disappearance
        UIView.animate(withDuration: AppConstants.UI_CONFIG.ANIMATION_DURATION, animations: {
            self.alpha = 0
        }, completion: { _ in
            self.activityIndicator.stopAnimating()
            self.isHidden = true
            self.isAnimating = false
        })
        
        updateAccessibility()
        UIAccessibility.post(notification: .layoutChanged, argument: nil)
    }
    
    /// Updates the loading message text with accessibility announcement
    /// - Parameter message: New message text to display
    public func updateMessage(_ message: String) {
        self.message = message
    }
    
    // MARK: - Layout
    
    public override func layoutSubviews() {
        super.layoutSubviews()
        
        // Ensure minimum touch target size
        let minSize = CGSize(width: minimumTouchSize, height: minimumTouchSize)
        bounds = CGRect(origin: bounds.origin, 
                       size: CGSize(width: max(bounds.width, minSize.width),
                                  height: max(bounds.height, minSize.height)))
    }
}