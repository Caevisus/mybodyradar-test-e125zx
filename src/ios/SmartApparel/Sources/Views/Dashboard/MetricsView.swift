//
// MetricsView.swift
// SmartApparel
//
// High-performance metrics visualization with HIPAA compliance and real-time updates
// UIKit version: Latest
// Combine version: Latest
//

import UIKit
import Combine

/// Thread-safe custom view for displaying real-time performance metrics and sensor data visualizations
@MainActor
public final class MetricsView: UIView {
    
    // MARK: - Private Properties
    
    private let chartView: ChartView
    private let metricsStack: UIStackView
    private let muscleActivityLabel: UILabel
    private let balanceScoreLabel: UILabel
    private let viewModel: DashboardViewModel
    private var cancellables = Set<AnyCancellable>()
    private let updateQueue: DispatchQueue
    private var displayLink: CADisplayLink?
    private var lastUpdateTime: CFTimeInterval
    
    // Constants
    private let updateInterval: TimeInterval = 0.1 // 100ms as per specs
    private let animationDuration: TimeInterval = AppConstants.UI_CONFIG.ANIMATION_DURATION
    private let cornerRadius: CGFloat = AppConstants.UI_CONFIG.CORNER_RADIUS
    
    // MARK: - Initialization
    
    /// Initializes the metrics view with a view model and configures high-performance updates
    public init(viewModel: DashboardViewModel, frame: CGRect = .zero) {
        self.viewModel = viewModel
        self.chartView = ChartView(frame: .zero)
        self.metricsStack = UIStackView()
        self.muscleActivityLabel = UILabel()
        self.balanceScoreLabel = UILabel()
        self.updateQueue = DispatchQueue(label: "com.smartapparel.metricsview.update",
                                       qos: .userInteractive)
        self.lastUpdateTime = CACurrentMediaTime()
        
        super.init(frame: frame)
        
        setupUI()
        setupBindings()
        configureDisplayLink()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    deinit {
        displayLink?.invalidate()
        cancellables.removeAll()
    }
    
    // MARK: - Private Methods
    
    private func setupUI() {
        // Configure chart view
        chartView.anchor()
        chartView.configureHeatMap(.default)
        chartView.setUpdateFrequency(updateInterval)
        
        // Configure metrics stack
        metricsStack.axis = .vertical
        metricsStack.spacing = 8
        metricsStack.distribution = .fillEqually
        metricsStack.alignment = .fill
        metricsStack.anchor()
        
        // Configure labels
        muscleActivityLabel.font = .systemFont(ofSize: 16, weight: .medium)
        muscleActivityLabel.textColor = .label
        muscleActivityLabel.numberOfLines = 1
        muscleActivityLabel.adjustsFontSizeToFitWidth = true
        muscleActivityLabel.anchor()
        
        balanceScoreLabel.font = .systemFont(ofSize: 16, weight: .medium)
        balanceScoreLabel.textColor = .label
        balanceScoreLabel.numberOfLines = 1
        balanceScoreLabel.adjustsFontSizeToFitWidth = true
        balanceScoreLabel.anchor()
        
        // Add subviews
        addSubview(chartView)
        addSubview(metricsStack)
        metricsStack.addArrangedSubview(muscleActivityLabel)
        metricsStack.addArrangedSubview(balanceScoreLabel)
        
        // Configure layout
        NSLayoutConstraint.activate([
            chartView.topAnchor.constraint(equalTo: topAnchor),
            chartView.leadingAnchor.constraint(equalTo: leadingAnchor),
            chartView.trailingAnchor.constraint(equalTo: trailingAnchor),
            chartView.heightAnchor.constraint(equalTo: heightAnchor, multiplier: 0.7),
            
            metricsStack.topAnchor.constraint(equalTo: chartView.bottomAnchor, constant: 16),
            metricsStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            metricsStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            metricsStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -16)
        ])
        
        // Configure appearance
        backgroundColor = .systemBackground
        layer.cornerRadius = cornerRadius
        layer.masksToBounds = true
        
        // Configure accessibility
        isAccessibilityElement = false
        accessibilityElements = [chartView, muscleActivityLabel, balanceScoreLabel]
        muscleActivityLabel.accessibilityLabel = "Muscle Activity"
        balanceScoreLabel.accessibilityLabel = "Balance Score"
    }
    
    private func setupBindings() {
        // Bind to metrics updates
        viewModel.$metrics
            .receive(on: DispatchQueue.main)
            .sink { [weak self] metrics in
                guard let self = self, let metrics = metrics else { return }
                self.updateMetrics(metrics)
            }
            .store(in: &cancellables)
        
        // Bind to heat map updates
        viewModel.$heatMapData
            .receive(on: DispatchQueue.main)
            .sink { [weak self] heatMapData in
                guard let self = self else { return }
                self.updateHeatMap(heatMapData)
            }
            .store(in: &cancellables)
        
        // Handle memory warnings
        NotificationCenter.default.publisher(for: UIApplication.didReceiveMemoryWarningNotification)
            .sink { [weak self] _ in
                self?.handleMemoryWarning()
            }
            .store(in: &cancellables)
    }
    
    private func configureDisplayLink() {
        displayLink = CADisplayLink(target: self, selector: #selector(displayLinkUpdate))
        displayLink?.preferredFramesPerSecond = Int(1.0 / updateInterval)
        displayLink?.add(to: .main, forMode: .common)
    }
    
    private func updateMetrics(_ metrics: SessionMetrics) {
        let currentTime = CACurrentMediaTime()
        guard (currentTime - lastUpdateTime) >= updateInterval else { return }
        
        updateQueue.async { [weak self] in
            guard let self = self else { return }
            
            DispatchQueue.main.async {
                // Update muscle activity
                if let muscleActivity = metrics.muscleActivity.values.first {
                    self.muscleActivityLabel.text = String(format: "Muscle Activity: %.1f%%", muscleActivity * 100)
                }
                
                // Update balance score
                if let balanceScore = metrics.forceDistribution.values.first {
                    self.balanceScoreLabel.text = String(format: "Balance Score: %.1f%%", balanceScore * 100)
                }
                
                self.lastUpdateTime = currentTime
            }
        }
    }
    
    private func updateHeatMap(_ heatMapData: [String: Double]) {
        updateQueue.async { [weak self] in
            guard let self = self else { return }
            
            let values = Array(heatMapData.values)
            self.chartView.updateChartData(
                values,
                type: .heatMap,
                options: .init(
                    animated: true,
                    duration: self.animationDuration,
                    easingOption: .easeInOutCubic
                )
            )
        }
    }
    
    @objc private func displayLinkUpdate() {
        // Handle display link updates if needed
        let currentTime = CACurrentMediaTime()
        if (currentTime - lastUpdateTime) >= updateInterval {
            lastUpdateTime = currentTime
        }
    }
    
    private func handleMemoryWarning() {
        // Clear any cached data and reduce memory footprint
        chartView.layer.shouldRasterize = true
        chartView.layer.rasterizationScale = UIScreen.main.scale
    }
}