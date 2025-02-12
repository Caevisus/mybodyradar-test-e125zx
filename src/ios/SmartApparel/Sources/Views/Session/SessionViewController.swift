//
// SessionViewController.swift
// SmartApparel
//
// Thread-safe view controller managing training session interface with real-time data visualization
// UIKit version: Latest
// Combine version: Latest
//

import UIKit
import Combine

@MainActor
public final class SessionViewController: UIViewController {
    
    // MARK: - Properties
    
    private let viewModel: SessionViewModel
    private let sensorStatusView: SensorStatusView
    private let heatMapView: HeatMapView
    private let metricsView: SessionMetricsView
    private let startButton: AccessibleButton
    private let endButton: AccessibleButton
    private var cancellables = Set<AnyCancellable>()
    private let performanceMonitor: PerformanceMonitor
    private let stateRestorationManager: StateRestorationManager
    private let errorHandler: SessionErrorHandler
    
    // Performance tracking
    private var lastUpdateTimestamp: TimeInterval = 0
    private let minimumUpdateInterval: TimeInterval = 1.0 / 60.0 // 60 FPS target
    private let displayLink: CADisplayLink?
    
    // MARK: - Initialization
    
    public init(viewModel: SessionViewModel,
                performanceMonitor: PerformanceMonitor,
                stateRestorationManager: StateRestorationManager) {
        self.viewModel = viewModel
        self.performanceMonitor = performanceMonitor
        self.stateRestorationManager = stateRestorationManager
        
        // Initialize UI components
        self.sensorStatusView = SensorStatusView()
        self.heatMapView = HeatMapView()
        self.metricsView = SessionMetricsView()
        
        // Initialize accessible buttons
        self.startButton = AccessibleButton(type: .system)
        self.endButton = AccessibleButton(type: .system)
        
        // Initialize error handler
        self.errorHandler = SessionErrorHandler()
        
        // Initialize display link for smooth updates
        self.displayLink = CADisplayLink(target: self, selector: #selector(displayLinkUpdate))
        
        super.init(nibName: nil, bundle: nil)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Lifecycle Methods
    
    public override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        setupBindings()
        setupAccessibility()
        configurePerformanceMonitoring()
        
        // Start display link
        displayLink?.preferredFramesPerSecond = 60
        displayLink?.add(to: .main, forMode: .common)
    }
    
    public override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        restoreState()
    }
    
    public override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        saveState()
    }
    
    // MARK: - UI Setup
    
    private func setupUI() {
        view.backgroundColor = .systemBackground
        
        // Configure sensor status view
        sensorStatusView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(sensorStatusView)
        
        // Configure heat map view
        heatMapView.translatesAutoresizingMaskIntoConstraints = false
        heatMapView.accessibilityLabel = "Muscle activity heat map"
        heatMapView.isAccessibilityElement = true
        view.addSubview(heatMapView)
        
        // Configure metrics view
        metricsView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(metricsView)
        
        // Configure buttons
        configureButtons()
        
        // Apply Auto Layout constraints
        NSLayoutConstraint.activate([
            // Sensor status view constraints
            sensorStatusView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            sensorStatusView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            sensorStatusView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            sensorStatusView.heightAnchor.constraint(equalToConstant: 48),
            
            // Heat map view constraints
            heatMapView.topAnchor.constraint(equalTo: sensorStatusView.bottomAnchor, constant: 16),
            heatMapView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            heatMapView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            heatMapView.heightAnchor.constraint(equalTo: view.heightAnchor, multiplier: 0.4),
            
            // Metrics view constraints
            metricsView.topAnchor.constraint(equalTo: heatMapView.bottomAnchor, constant: 16),
            metricsView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            metricsView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            
            // Button constraints
            startButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
            startButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            startButton.widthAnchor.constraint(equalToConstant: 200),
            startButton.heightAnchor.constraint(equalToConstant: 48),
            
            endButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
            endButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            endButton.widthAnchor.constraint(equalToConstant: 200),
            endButton.heightAnchor.constraint(equalToConstant: 48)
        ])
    }
    
    private func configureButtons() {
        startButton.translatesAutoresizingMaskIntoConstraints = false
        endButton.translatesAutoresizingMaskIntoConstraints = false
        
        startButton.setTitle("Start Session", for: .normal)
        endButton.setTitle("End Session", for: .normal)
        
        startButton.accessibilityLabel = "Start training session"
        endButton.accessibilityLabel = "End training session"
        
        startButton.addTarget(self, action: #selector(handleStartSession), for: .touchUpInside)
        endButton.addTarget(self, action: #selector(handleEndSession), for: .touchUpInside)
        
        view.addSubview(startButton)
        view.addSubview(endButton)
        
        endButton.isHidden = true
    }
    
    // MARK: - Bindings Setup
    
    private func setupBindings() {
        // Bind session status updates
        viewModel.$sessionStatus
            .receive(on: DispatchQueue.main)
            .sink { [weak self] status in
                self?.updateUIForSessionStatus(status)
            }
            .store(in: &cancellables)
        
        // Bind sensor data updates with performance monitoring
        viewModel.$currentSession
            .receive(on: DispatchQueue.main)
            .sink { [weak self] session in
                guard let session = session else { return }
                self?.performanceMonitor.startMeasurement()
                self?.updateVisualization(for: session)
                self?.performanceMonitor.endMeasurement()
            }
            .store(in: &cancellables)
    }
    
    // MARK: - Accessibility Setup
    
    private func setupAccessibility() {
        view.accessibilityElements = [sensorStatusView, heatMapView, metricsView, startButton, endButton]
        
        // Configure dynamic type support
        startButton.titleLabel?.adjustsFontForContentSizeCategory = true
        endButton.titleLabel?.adjustsFontForContentSizeCategory = true
        
        // Configure voice over hints
        startButton.accessibilityHint = "Double tap to start a new training session"
        endButton.accessibilityHint = "Double tap to end the current training session"
        
        // Configure accessibility notifications
        UIAccessibility.post(notification: .screenChanged, argument: "Session view loaded")
    }
    
    // MARK: - Session Handling
    
    @objc private func handleStartSession() {
        Task {
            startButton.isEnabled = false
            
            do {
                let result = await viewModel.startSession(athleteId: UUID(), type: .training)
                switch result {
                case .success:
                    updateUIForSessionStatus(.active)
                case .failure(let error):
                    errorHandler.handle(error)
                }
            } catch {
                errorHandler.handle(error)
            }
            
            startButton.isEnabled = true
        }
    }
    
    @objc private func handleEndSession() {
        Task {
            let alert = UIAlertController(
                title: "End Session",
                message: "Are you sure you want to end the current session?",
                preferredStyle: .alert
            )
            
            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
            alert.addAction(UIAlertAction(title: "End", style: .destructive) { [weak self] _ in
                Task {
                    await self?.endSession()
                }
            })
            
            present(alert, animated: true)
        }
    }
    
    private func endSession() async {
        endButton.isEnabled = false
        
        do {
            let result = await viewModel.endSession()
            switch result {
            case .success:
                updateUIForSessionStatus(.completed)
            case .failure(let error):
                errorHandler.handle(error)
            }
        } catch {
            errorHandler.handle(error)
        }
        
        endButton.isEnabled = true
    }
    
    // MARK: - UI Updates
    
    private func updateUIForSessionStatus(_ status: SessionStatus) {
        switch status {
        case .active:
            startButton.isHidden = true
            endButton.isHidden = false
            UIAccessibility.post(notification: .announcement, argument: "Session started")
        case .completed, .cancelled:
            startButton.isHidden = false
            endButton.isHidden = true
            UIAccessibility.post(notification: .announcement, argument: "Session ended")
        case .pending:
            startButton.isHidden = false
            endButton.isHidden = true
        }
    }
    
    @objc private func displayLinkUpdate() {
        guard let session = viewModel.currentSession,
              CACurrentMediaTime() - lastUpdateTimestamp >= minimumUpdateInterval else {
            return
        }
        
        performanceMonitor.startMeasurement()
        updateVisualization(for: session)
        performanceMonitor.endMeasurement()
        
        lastUpdateTimestamp = CACurrentMediaTime()
    }
    
    private func updateVisualization(for session: Session) {
        // Update heat map visualization
        heatMapView.update(with: session.metrics)
        
        // Update metrics display
        metricsView.update(with: session.metrics)
        
        // Update sensor status
        if let sensorData = session.currentSensorData {
            sensorStatusView.updateStatus(with: sensorData)
        }
    }
    
    // MARK: - State Management
    
    private func saveState() {
        stateRestorationManager.save(viewController: self)
    }
    
    private func restoreState() {
        stateRestorationManager.restore(viewController: self)
    }
    
    // MARK: - Performance Monitoring
    
    private func configurePerformanceMonitoring() {
        performanceMonitor.configure(
            target: self,
            metrics: [
                "visualization_latency",
                "ui_update_frequency",
                "memory_usage"
            ]
        )
    }
    
    // MARK: - Cleanup
    
    deinit {
        displayLink?.invalidate()
        cancellables.removeAll()
        performanceMonitor.stopMonitoring()
    }
}