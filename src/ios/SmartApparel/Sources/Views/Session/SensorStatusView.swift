//
// SensorStatusView.swift
// SmartApparel
//
// A Material Design 3.0 compliant sensor status visualization component
// UIKit version: Latest
//

import UIKit

@IBDesignable
public class SensorStatusView: UIView {
    
    // MARK: - UI Components
    private let statusLabel: UILabel = {
        let label = UILabel()
        label.font = .systemFont(ofSize: 16, weight: .medium) // MD3 Body Large
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private let statusIcon: UIImageView = {
        let imageView = UIImageView()
        imageView.contentMode = .scaleAspectFit
        imageView.translatesAutoresizingMaskIntoConstraints = false
        return imageView
    }()
    
    private let containerStack: UIStackView = {
        let stack = UIStackView()
        stack.axis = .horizontal
        stack.spacing = 8 // MD3 standard spacing
        stack.alignment = .center
        stack.translatesAutoresizingMaskIntoConstraints = false
        return stack
    }()
    
    // MARK: - Properties
    private var sensorData: SensorData?
    private let updateQueue = DispatchQueue(label: "com.smartapparel.sensorstatus", qos: .userInteractive)
    private var displayLink: CADisplayLink?
    
    /// Minimum time interval between updates (in seconds)
    public var updateThreshold: TimeInterval = 1.0 / 60.0 // 60 FPS max
    private var lastUpdateTime: TimeInterval = 0
    
    // MARK: - Initialization
    override public init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
        setupDisplayLink()
        setupAccessibility()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupUI()
        setupDisplayLink()
        setupAccessibility()
    }
    
    // MARK: - UI Setup
    private func setupUI() {
        // Configure container view with Material Design elevation
        layer.cornerRadius = 8
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOffset = CGSize(width: 0, height: 2)
        layer.shadowRadius = 4
        layer.shadowOpacity = 0.1
        
        // Setup view hierarchy
        addSubview(containerStack)
        containerStack.addArrangedSubview(statusIcon)
        containerStack.addArrangedSubview(statusLabel)
        
        // Configure status icon size (24x24 as per Material Design)
        NSLayoutConstraint.activate([
            containerStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            containerStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            containerStack.topAnchor.constraint(equalTo: topAnchor, constant: 12),
            containerStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -12),
            
            statusIcon.widthAnchor.constraint(equalToConstant: 24),
            statusIcon.heightAnchor.constraint(equalToConstant: 24)
        ])
        
        // Set initial state
        updateStatusDisplay(status: .inactive, type: .imu)
    }
    
    private func setupDisplayLink() {
        displayLink = CADisplayLink(target: self, selector: #selector(displayLinkTick))
        displayLink?.preferredFramesPerSecond = 60
        displayLink?.add(to: .main, forMode: .common)
    }
    
    private func setupAccessibility() {
        isAccessibilityElement = true
        accessibilityTraits = .updatesFrequently
    }
    
    // MARK: - Public Interface
    public func updateStatus(with data: SensorData) {
        let currentTime = CACurrentMediaTime()
        guard (currentTime - lastUpdateTime) >= updateThreshold else { return }
        
        updateQueue.async { [weak self] in
            guard let self = self else { return }
            self.sensorData = data
            
            DispatchQueue.main.async {
                self.updateStatusDisplay(status: data.status, type: data.type)
                self.lastUpdateTime = currentTime
            }
        }
    }
    
    // MARK: - Private Methods
    private func updateStatusDisplay(status: SensorStatus, type: SensorType) {
        // Update status icon
        let iconName: String
        switch status {
        case .active:
            iconName = "checkmark.circle.fill"
        case .inactive:
            iconName = "circle"
        case .calibrating:
            iconName = "gear"
        case .error:
            iconName = "exclamationmark.circle.fill"
        }
        statusIcon.image = UIImage(systemName: iconName)?.withRenderingMode(.alwaysTemplate)
        
        // Update status text
        let typeText = type == .imu ? "IMU" : "ToF"
        let statusText: String
        switch status {
        case .active:
            statusText = "\(typeText) Sensor Active"
        case .inactive:
            statusText = "\(typeText) Sensor Inactive"
        case .calibrating:
            statusText = "\(typeText) Sensor Calibrating"
        case .error:
            statusText = "\(typeText) Sensor Error"
        }
        statusLabel.text = statusText
        
        // Update colors based on status
        let statusColor = getStatusColor(status)
        statusIcon.tintColor = statusColor
        statusLabel.textColor = statusColor
        
        // Update accessibility
        accessibilityLabel = statusText
        accessibilityValue = status == .active ? "Connected" : "Disconnected"
        
        // Animate changes
        UIView.animate(withDuration: 0.3, 
                      delay: 0,
                      options: [.beginFromCurrentState, .curveEaseInOut]) {
            self.alpha = status == .inactive ? 0.6 : 1.0
        }
    }
    
    private func getStatusColor(_ status: SensorStatus) -> UIColor {
        switch status {
        case .active:
            return UIColor.systemGreen
        case .inactive:
            return UIColor.systemGray
        case .calibrating:
            return UIColor.systemOrange
        case .error:
            return UIColor.systemRed
        }
    }
    
    @objc private func displayLinkTick() {
        if let data = sensorData, data.status == .calibrating {
            // Rotate gear icon during calibration
            let rotation = CABasicAnimation(keyPath: "transform.rotation")
            rotation.fromValue = 0
            rotation.toValue = 2 * Double.pi
            rotation.duration = 1.0
            rotation.repeatCount = .infinity
            statusIcon.layer.add(rotation, forKey: "rotationAnimation")
        } else {
            statusIcon.layer.removeAnimation(forKey: "rotationAnimation")
        }
    }
    
    // MARK: - Cleanup
    deinit {
        displayLink?.invalidate()
    }
}