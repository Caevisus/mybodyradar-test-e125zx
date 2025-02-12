import UIKit

/// Scene delegate responsible for managing the app's window and UI lifecycle in the multi-window iOS environment
@available(iOS 14.0, *)
final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    
    // MARK: - Properties
    
    var window: UIWindow?
    
    private var authObserver: AnyCancellable?
    private var performanceMonitor: ScenePerformanceMonitor?
    private var stateRestoration: SceneStateRestoration?
    
    // MARK: - Scene Lifecycle
    
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        
        // Initialize performance monitoring
        performanceMonitor = ScenePerformanceMonitor()
        performanceMonitor?.startMonitoring()
        
        // Configure window with security settings
        window = UIWindow(windowScene: windowScene)
        window?.backgroundColor = .systemBackground
        window?.tintColor = .primary
        
        // Configure root view controller based on authentication state
        configureRootViewController()
        
        // Setup authentication observer
        setupAuthObserver()
        
        // Configure state restoration
        stateRestoration = SceneStateRestoration(session: session)
        if let restoredState = stateRestoration?.restoreState() {
            window?.windowScene?.userActivity = restoredState
        }
        
        // Configure accessibility
        window?.accessibilityViewIsModal = false
        UIAccessibility.post(notification: .screenChanged, argument: window?.rootViewController)
        
        // Make window visible
        window?.makeKeyAndVisible()
        
        // Log scene creation
        AnalyticsService.shared.logSceneEvent(
            "Scene connected",
            metadata: [
                "sessionId": session.persistentIdentifier,
                "configurationName": session.configuration.name ?? "default"
            ]
        )
    }
    
    func sceneDidDisconnect(_ scene: UIScene) {
        // Save secure state
        if let activity = window?.windowScene?.userActivity {
            stateRestoration?.saveState(activity)
        }
        
        // Clear sensitive data
        AuthenticationService.shared.logout()
        
        // Stop monitoring
        performanceMonitor?.stopMonitoring()
        authObserver?.cancel()
        
        // Log disconnection
        AnalyticsService.shared.logSceneEvent(
            "Scene disconnected",
            metadata: ["timestamp": Date().timeIntervalSince1970]
        )
    }
    
    func sceneDidBecomeActive(_ scene: UIScene) {
        // Verify authentication state
        verifyAuthenticationState()
        
        // Resume UI updates
        window?.rootViewController?.view.layer.speed = 1.0
        
        // Start monitoring services
        performanceMonitor?.resumeMonitoring()
        
        // Log activation
        AnalyticsService.shared.logSceneEvent(
            "Scene became active",
            metadata: ["timestamp": Date().timeIntervalSince1970]
        )
    }
    
    func sceneWillResignActive(_ scene: UIScene) {
        // Pause UI updates
        window?.rootViewController?.view.layer.speed = 0.0
        
        // Secure sensitive data
        if let activity = window?.windowScene?.userActivity {
            stateRestoration?.saveState(activity)
        }
        
        // Pause monitoring
        performanceMonitor?.pauseMonitoring()
        
        // Log deactivation
        AnalyticsService.shared.logSceneEvent(
            "Scene resigned active",
            metadata: ["timestamp": Date().timeIntervalSince1970]
        )
    }
    
    // MARK: - Private Methods
    
    private func configureRootViewController() {
        let currentUser = AuthenticationService.shared.getCurrentUser()
        
        if currentUser != nil {
            // User is authenticated, show dashboard
            let dashboardVC = DashboardViewController()
            let navigationController = UINavigationController(rootViewController: dashboardVC)
            navigationController.navigationBar.prefersLargeTitles = true
            window?.rootViewController = navigationController
        } else {
            // User needs to authenticate
            let authVC = AuthenticationViewController()
            window?.rootViewController = authVC
        }
    }
    
    private func setupAuthObserver() {
        authObserver = AuthenticationService.shared.observeAuthState()
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                switch state {
                case .authenticated:
                    self?.handleAuthenticationSuccess()
                case .unauthenticated:
                    self?.handleAuthenticationFailure()
                case .error:
                    self?.handleAuthenticationError()
                }
            }
    }
    
    private func verifyAuthenticationState() {
        guard let currentUser = AuthenticationService.shared.getCurrentUser() else {
            handleAuthenticationFailure()
            return
        }
        
        // Verify session validity
        if !AuthenticationService.shared.isSessionValid(for: currentUser) {
            handleAuthenticationFailure()
        }
    }
    
    private func handleAuthenticationSuccess() {
        UIView.transition(with: window!, duration: AppConstants.UI_CONFIG.ANIMATION_DURATION, options: .transitionCrossDissolve) {
            self.configureRootViewController()
        }
    }
    
    private func handleAuthenticationFailure() {
        AuthenticationService.shared.logout()
        UIView.transition(with: window!, duration: AppConstants.UI_CONFIG.ANIMATION_DURATION, options: .transitionCrossDissolve) {
            self.configureRootViewController()
        }
    }
    
    private func handleAuthenticationError() {
        // Show error alert
        let alert = UIAlertController(
            title: "Authentication Error",
            message: "Please try logging in again.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            self.handleAuthenticationFailure()
        })
        window?.rootViewController?.present(alert, animated: true)
    }
    
    private func handleMemoryWarning() {
        // Clear non-essential caches
        stateRestoration?.clearCache()
        performanceMonitor?.clearMetrics()
        
        // Log memory warning
        AnalyticsService.shared.logSceneEvent(
            "Memory warning received",
            metadata: ["freeMemory": ProcessInfo.processInfo.physicalMemory]
        )
    }
}

// MARK: - Supporting Types

private final class ScenePerformanceMonitor {
    private var metrics: [String: TimeInterval] = [:]
    private let queue = DispatchQueue(label: "com.smartapparel.scene.performance")
    
    func startMonitoring() {
        queue.async {
            self.metrics["startTime"] = CACurrentMediaTime()
        }
    }
    
    func stopMonitoring() {
        queue.async {
            self.metrics.removeAll()
        }
    }
    
    func pauseMonitoring() {
        queue.async {
            self.metrics["pauseTime"] = CACurrentMediaTime()
        }
    }
    
    func resumeMonitoring() {
        queue.async {
            self.metrics["resumeTime"] = CACurrentMediaTime()
        }
    }
    
    func clearMetrics() {
        queue.async {
            self.metrics.removeAll()
        }
    }
}

private final class SceneStateRestoration {
    private let session: UISceneSession
    private var cache: [String: Any] = [:]
    
    init(session: UISceneSession) {
        self.session = session
    }
    
    func saveState(_ activity: NSUserActivity) {
        cache["lastActivity"] = activity
        session.stateRestorationActivity = activity
    }
    
    func restoreState() -> NSUserActivity? {
        return session.stateRestorationActivity
    }
    
    func clearCache() {
        cache.removeAll()
    }
}