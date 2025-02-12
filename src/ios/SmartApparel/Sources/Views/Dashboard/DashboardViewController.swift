//
// DashboardViewController.swift
// SmartApparel
//
// Enterprise-grade dashboard view controller with comprehensive error handling,
// accessibility support, and performance optimization
// UIKit version: Latest
// Combine version: Latest
//

import UIKit
import Combine

/// Main view controller for the dashboard screen with real-time performance monitoring
final class DashboardViewController: UIViewController {
    
    // MARK: - Private Properties
    
    private let viewModel: DashboardViewModel
    private let metricsView: MetricsView
    private let loadingView: LoadingView
    private let logger: Logger
    private var cancellables = Set<AnyCancellable>()
    private var displayLink: CADisplayLink?
    private var retryCount = 0
    private var stateRestorationActivity: NSUserActivity?
    
    // Constants
    private let maxRetryAttempts = AppConstants.APP_CONFIG.MAX_RETRY_ATTEMPTS
    private let loadingTimeout = AppConstants.UI_CONFIG.LOADING_TIMEOUT
    private let animationDuration = AppConstants.UI_CONFIG.ANIMATION_DURATION
    
    // MARK: - UI Components
    
    private lazy var sessionControlStack: UIStackView = {
        let stack = UIStackView()
        stack.axis = .horizontal
        stack.distribution = .fillEqually
        stack.spacing = AppConstants.UI_CONFIG.DEFAULT_PADDING
        return stack
    }()
    
    private lazy var startButton: UIButton = {
        let button = UIButton(type: .system)
        button.setTitle("Start Session", for: .normal)
        button.addTarget(self, action: #selector(startSessionTapped), for: .touchUpInside)
        button.isAccessibilityElement = true
        button.accessibilityLabel = "Start training session"
        button.accessibilityTraits = .button
        return button
    }()
    
    private lazy var endButton: UIButton = {
        let button = UIButton(type: .system)
        button.setTitle("End Session", for: .normal)
        button.addTarget(self, action: #selector(endSessionTapped), for: .touchUpInside)
        button.isEnabled = false
        button.isAccessibilityElement = true
        button.accessibilityLabel = "End current session"
        button.accessibilityTraits = .button
        return button
    }()
    
    // MARK: - Initialization
    
    init(viewModel: DashboardViewModel, logger: Logger) {
        self.viewModel = viewModel
        self.logger = logger
        self.metricsView = MetricsView(viewModel: viewModel)
        self.loadingView = LoadingView(message: "Initializing dashboard...")
        
        super.init(nibName: nil, bundle: nil)
        
        setupStateRestoration()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Lifecycle Methods
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        setupUI()
        setupBindings()
        configurePerformanceMonitoring()
        
        logger.log(
            "Dashboard view controller loaded",
            level: .info,
            category: .general
        )
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        startPerformanceMonitoring()
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        stopPerformanceMonitoring()
    }
    
    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
        handleMemoryWarning()
    }
    
    // MARK: - Private Methods
    
    private func setupUI() {
        // Configure navigation bar
        title = "Dashboard"
        navigationController?.navigationBar.prefersLargeTitles = true
        
        // Configure view hierarchy
        view.backgroundColor = .systemBackground
        
        // Add and configure metrics view
        view.addSubview(metricsView.anchor())
        
        // Add and configure session control stack
        view.addSubview(sessionControlStack.anchor())
        sessionControlStack.addArrangedSubview(startButton)
        sessionControlStack.addArrangedSubview(endButton)
        
        // Add loading view
        view.addSubview(loadingView.anchor())
        
        // Configure layout constraints
        NSLayoutConstraint.activate([
            metricsView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            metricsView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            metricsView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            
            sessionControlStack.topAnchor.constraint(equalTo: metricsView.bottomAnchor, constant: 16),
            sessionControlStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            sessionControlStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            sessionControlStack.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
            
            loadingView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            loadingView.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
    }
    
    private func setupBindings() {
        // Bind to session state
        viewModel.$currentSession
            .receive(on: DispatchQueue.main)
            .sink { [weak self] session in
                self?.updateUIForSession(session)
            }
            .store(in: &cancellables)
        
        // Bind to loading state with timeout
        viewModel.$isLoading
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isLoading in
                self?.handleLoadingState(isLoading)
            }
            .store(in: &cancellables)
        
        // Bind to errors
        viewModel.$error
            .receive(on: DispatchQueue.main)
            .sink { [weak self] error in
                if let error = error {
                    self?.handleError(error)
                }
            }
            .store(in: &cancellables)
    }
    
    private func configurePerformanceMonitoring() {
        displayLink = CADisplayLink(target: self, selector: #selector(displayLinkUpdate))
        displayLink?.preferredFramesPerSecond = 60
        displayLink?.add(to: .main, forMode: .common)
    }
    
    private func startPerformanceMonitoring() {
        displayLink?.isPaused = false
    }
    
    private func stopPerformanceMonitoring() {
        displayLink?.isPaused = true
    }
    
    private func updateUIForSession(_ session: Session?) {
        startButton.isEnabled = session == nil
        endButton.isEnabled = session != nil
        
        if let session = session {
            logger.log(
                "Session active: \(session.id)",
                level: .info,
                category: .general
            )
        }
    }
    
    private func handleLoadingState(_ isLoading: Bool) {
        if isLoading {
            loadingView.startAnimating()
            startLoadingTimeout()
        } else {
            loadingView.stopAnimating()
        }
    }
    
    private func startLoadingTimeout() {
        DispatchQueue.main.asyncAfter(deadline: .now() + loadingTimeout) { [weak self] in
            guard let self = self, self.loadingView.isAnimating else { return }
            
            self.loadingView.stopAnimating()
            self.handleError(.dataProcessingError("Operation timed out"))
        }
    }
    
    private func handleError(_ error: DashboardError) {
        logger.error(
            "Dashboard error occurred",
            category: .general,
            error: error as NSError
        )
        
        let alert = UIAlertController(
            title: "Error",
            message: error.localizedDescription,
            preferredStyle: .alert
        )
        
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        
        if retryCount < maxRetryAttempts {
            alert.addAction(UIAlertAction(title: "Retry", style: .default) { [weak self] _ in
                self?.retryLastOperation()
            })
        }
        
        present(alert, animated: true)
    }
    
    private func retryLastOperation() {
        retryCount += 1
        // Implement retry logic based on last operation
    }
    
    private func handleMemoryWarning() {
        logger.log(
            "Handling memory warning in dashboard",
            level: .warning,
            category: .general
        )
        
        // Clear non-essential resources
        cancellables.removeAll()
        
        // Reset retry count
        retryCount = 0
    }
    
    private func setupStateRestoration() {
        stateRestorationActivity = NSUserActivity(activityType: "com.smartapparel.dashboard")
        stateRestorationActivity?.title = "Dashboard"
        view.window?.windowScene?.userActivity = stateRestorationActivity
    }
    
    // MARK: - Actions
    
    @objc private func startSessionTapped() {
        Task {
            let result = await viewModel.startSession(athleteId: UUID())
            
            if case .failure(let error) = result {
                await MainActor.run {
                    handleError(error)
                }
            }
        }
    }
    
    @objc private func endSessionTapped() {
        Task {
            let result = await viewModel.endSession()
            
            if case .failure(let error) = result {
                await MainActor.run {
                    handleError(error)
                }
            }
        }
    }
    
    @objc private func displayLinkUpdate() {
        // Handle any UI updates that need to be synchronized with screen refresh
    }
}