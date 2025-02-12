//
// AthleteCell.swift
// SmartApparel
//
// Thread-safe, accessibility-compliant UITableViewCell for athlete information display
// UIKit version: Latest
// SwiftUI version: Latest
// Combine version: Latest
//

import UIKit
import SwiftUI
import Combine

// MARK: - Sensor Visualization View

private struct SensorVisualizationView: View {
    let sensorData: SensorData?
    
    var body: some View {
        GeometryReader { geometry in
            if let data = sensorData {
                HStack(spacing: 4) {
                    ForEach(data.currentReadings.prefix(5), id: \.self) { reading in
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color(UIColor.systemBlue))
                            .frame(width: geometry.size.width / 6,
                                   height: geometry.size.height * CGFloat(reading / 100.0))
                            .animation(.easeInOut(duration: 0.3), value: reading)
                    }
                }
            } else {
                Text("No Data")
                    .foregroundColor(.secondary)
            }
        }
    }
}

// MARK: - AthleteCell

@IBDesignable
public final class AthleteCell: UITableViewCell {
    
    // MARK: - UI Components
    
    private let profileImageView: UIImageView = {
        let imageView = UIImageView()
        imageView.contentMode = .scaleAspectFill
        imageView.layer.cornerRadius = 25
        imageView.layer.masksToBounds = true
        imageView.backgroundColor = .systemGray5
        return imageView
    }()
    
    private let nameLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .headline)
        label.adjustsFontForContentSizeCategory = true
        label.numberOfLines = 1
        return label
    }()
    
    private let statusLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .subheadline)
        label.adjustsFontForContentSizeCategory = true
        label.textColor = .secondaryLabel
        label.numberOfLines = 1
        return label
    }()
    
    private let sensorStatusIndicator: UIView = {
        let view = UIView()
        view.layer.cornerRadius = 6
        view.layer.masksToBounds = true
        return view
    }()
    
    private lazy var sensorVisualization: UIHostingController<SensorVisualizationView> = {
        let hostingController = UIHostingController(
            rootView: SensorVisualizationView(sensorData: nil)
        )
        hostingController.view.backgroundColor = .clear
        return hostingController
    }()
    
    private let metricsStackView: UIStackView = {
        let stackView = UIStackView()
        stackView.axis = .horizontal
        stackView.distribution = .fillEqually
        stackView.spacing = 8
        return stackView
    }()
    
    // MARK: - Properties
    
    private var athlete: Athlete?
    private var cancellables = Set<AnyCancellable>()
    private let dataLock = NSLock()
    
    // MARK: - Initialization
    
    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupUI()
    }
    
    // MARK: - UI Setup
    
    private func setupUI() {
        // Configure content view
        contentView.backgroundColor = .systemBackground
        
        // Add shadow and elevation
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOffset = CGSize(width: 0, height: 2)
        layer.shadowRadius = 4
        layer.shadowOpacity = 0.1
        
        // Add subviews
        contentView.addSubview(profileImageView)
        contentView.addSubview(nameLabel)
        contentView.addSubview(statusLabel)
        contentView.addSubview(sensorStatusIndicator)
        contentView.addSubview(sensorVisualization.view)
        contentView.addSubview(metricsStackView)
        
        // Configure constraints
        profileImageView.translatesAutoresizingMaskIntoConstraints = false
        nameLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        sensorStatusIndicator.translatesAutoresizingMaskIntoConstraints = false
        sensorVisualization.view.translatesAutoresizingMaskIntoConstraints = false
        metricsStackView.translatesAutoresizingMaskIntoConstraints = false
        
        NSLayoutConstraint.activate([
            // Profile image
            profileImageView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            profileImageView.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            profileImageView.widthAnchor.constraint(equalToConstant: 50),
            profileImageView.heightAnchor.constraint(equalToConstant: 50),
            
            // Name label
            nameLabel.leadingAnchor.constraint(equalTo: profileImageView.trailingAnchor, constant: 12),
            nameLabel.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 12),
            nameLabel.trailingAnchor.constraint(equalTo: sensorStatusIndicator.leadingAnchor, constant: -8),
            
            // Status label
            statusLabel.leadingAnchor.constraint(equalTo: nameLabel.leadingAnchor),
            statusLabel.topAnchor.constraint(equalTo: nameLabel.bottomAnchor, constant: 4),
            statusLabel.trailingAnchor.constraint(equalTo: nameLabel.trailingAnchor),
            
            // Sensor status indicator
            sensorStatusIndicator.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            sensorStatusIndicator.centerYAnchor.constraint(equalTo: nameLabel.centerYAnchor),
            sensorStatusIndicator.widthAnchor.constraint(equalToConstant: 12),
            sensorStatusIndicator.heightAnchor.constraint(equalToConstant: 12),
            
            // Sensor visualization
            sensorVisualization.view.leadingAnchor.constraint(equalTo: nameLabel.leadingAnchor),
            sensorVisualization.view.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 8),
            sensorVisualization.view.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            sensorVisualization.view.heightAnchor.constraint(equalToConstant: 40),
            
            // Metrics stack
            metricsStackView.leadingAnchor.constraint(equalTo: nameLabel.leadingAnchor),
            metricsStackView.topAnchor.constraint(equalTo: sensorVisualization.view.bottomAnchor, constant: 8),
            metricsStackView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            metricsStackView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -12)
        ])
        
        // Configure accessibility
        configureAccessibility()
    }
    
    private func configureAccessibility() {
        isAccessibilityElement = true
        accessibilityTraits = .button
        
        profileImageView.isAccessibilityElement = false
        nameLabel.isAccessibilityElement = false
        statusLabel.isAccessibilityElement = false
        sensorStatusIndicator.isAccessibilityElement = false
        
        // Configure VoiceOver order
        accessibilityElements = [nameLabel, statusLabel, sensorVisualization.view, metricsStackView]
    }
    
    // MARK: - Configuration
    
    public func configure(with athlete: Athlete) {
        dataLock.lock()
        defer { dataLock.unlock() }
        
        // Clear previous subscriptions
        cancellables.removeAll()
        
        self.athlete = athlete
        
        // Update UI with initial data
        do {
            nameLabel.text = try athlete.name
            updateSensorStatus(athlete.currentSensorData)
        } catch {
            nameLabel.text = "Error loading name"
        }
        
        // Subscribe to sensor data updates
        athlete.sensorDataPublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] sensorData in
                self?.updateSensorStatus(sensorData)
            }
            .store(in: &cancellables)
        
        // Update accessibility label
        updateAccessibilityLabel()
    }
    
    private func updateSensorStatus(_ sensorData: SensorData?) {
        dataLock.lock()
        defer { dataLock.unlock() }
        
        if let data = sensorData {
            statusLabel.text = "Active"
            sensorStatusIndicator.backgroundColor = .systemGreen
            sensorVisualization.rootView = SensorVisualizationView(sensorData: data)
        } else {
            statusLabel.text = "Inactive"
            sensorStatusIndicator.backgroundColor = .systemGray
            sensorVisualization.rootView = SensorVisualizationView(sensorData: nil)
        }
        
        updateAccessibilityLabel()
    }
    
    private func updateAccessibilityLabel() {
        accessibilityLabel = "\(nameLabel.text ?? "Unknown athlete"), Status: \(statusLabel.text ?? "Unknown")"
    }
    
    // MARK: - Reuse
    
    override public func prepareForReuse() {
        super.prepareForReuse()
        
        dataLock.lock()
        defer { dataLock.unlock() }
        
        // Clear subscriptions
        cancellables.removeAll()
        
        // Reset UI state
        nameLabel.text = nil
        statusLabel.text = nil
        sensorStatusIndicator.backgroundColor = .systemGray
        sensorVisualization.rootView = SensorVisualizationView(sensorData: nil)
        
        // Reset accessibility
        accessibilityLabel = nil
        
        athlete = nil
    }
}