//
// AlertListViewController.swift
// SmartApparel
//
// Foundation version: Latest
// UIKit version: Latest
// Combine version: Latest
// LocalAuthentication version: Latest
// SecurityKit version: 1.0.0
//

import UIKit
import Combine
import LocalAuthentication
import SecurityKit

/// View controller managing the display and interaction of system alerts with enhanced security and performance
final class AlertListViewController: UIViewController {
    
    // MARK: - Constants
    
    private let CELL_REUSE_IDENTIFIER = "AlertCell"
    private let REFRESH_CONTROL_TINT_COLOR = UIColor.systemBlue
    private let PAGINATION_PAGE_SIZE = 20
    private let UPDATE_THROTTLE_INTERVAL = 0.1
    
    // MARK: - Properties
    
    private let tableView: UITableView
    private let viewModel: AlertViewModel
    private let refreshControl: UIRefreshControl
    private var cancellables = Set<AnyCancellable>()
    private var currentPage = 0
    private var isLoadingMore = false
    
    private lazy var dataSource: UITableViewDiffableDataSource<String, Alert> = {
        let dataSource = UITableViewDiffableDataSource<String, Alert>(
            tableView: tableView
        ) { [weak self] tableView, indexPath, alert in
            guard let cell = tableView.dequeueReusableCell(
                withIdentifier: self?.CELL_REUSE_IDENTIFIER ?? "",
                for: indexPath
            ) as? AlertCell else {
                return UITableViewCell()
            }
            
            cell.configure(with: alert)
            return cell
        }
        return dataSource
    }()
    
    // MARK: - Initialization
    
    init(securityContext: SecurityContext) {
        // Initialize core components
        self.tableView = UITableView(frame: .zero, style: .insetGrouped)
        self.viewModel = AlertViewModel()
        self.refreshControl = UIRefreshControl()
        
        super.init(nibName: nil, bundle: nil)
        
        // Configure view model with security context
        viewModel.securityContext = securityContext
        
        // Setup UI with Material Design 3.0
        setupUI()
        setupSecureBindings()
        setupAccessibility()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Lifecycle Methods
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Verify biometric authentication
        authenticateUser()
        
        // Configure navigation bar with Material Design
        setupNavigationBar()
        
        // Configure table view
        setupTableView()
        
        // Initial data fetch
        Task {
            await viewModel.fetchAlerts()
        }
    }
    
    // MARK: - Private Methods
    
    private func setupUI() {
        // Configure view hierarchy
        view.addSubview(tableView)
        
        // Apply Material Design 3.0 styling
        view.backgroundColor = .systemBackground
        tableView.backgroundColor = .systemGroupedBackground
        
        // Setup constraints
        tableView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }
    
    private func setupNavigationBar() {
        title = "Alerts"
        navigationController?.navigationBar.prefersLargeTitles = true
        
        // Add filter button
        let filterButton = UIBarButtonItem(
            image: UIImage(systemName: "line.3.horizontal.decrease.circle"),
            style: .plain,
            target: self,
            action: #selector(showFilterOptions)
        )
        navigationItem.rightBarButtonItem = filterButton
    }
    
    private func setupTableView() {
        // Register cell
        tableView.register(AlertCell.self, forCellReuseIdentifier: CELL_REUSE_IDENTIFIER)
        
        // Configure refresh control
        refreshControl.tintColor = REFRESH_CONTROL_TINT_COLOR
        refreshControl.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
        tableView.refreshControl = refreshControl
        
        // Configure table view
        tableView.delegate = self
        tableView.prefetchDataSource = self
        tableView.estimatedRowHeight = 88
        tableView.rowHeight = UITableView.automaticDimension
        tableView.separatorStyle = .none
    }
    
    private func setupSecureBindings() {
        // Bind alerts with throttling
        viewModel.$alerts
            .throttle(for: .seconds(UPDATE_THROTTLE_INTERVAL), scheduler: DispatchQueue.main, latest: true)
            .sink { [weak self] alerts in
                self?.updateDataSource(with: alerts)
            }
            .store(in: &cancellables)
        
        // Bind loading state
        viewModel.$isLoading
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isLoading in
                self?.updateLoadingState(isLoading)
            }
            .store(in: &cancellables)
    }
    
    private func setupAccessibility() {
        tableView.accessibilityLabel = "Alerts List"
        tableView.accessibilityHint = "Displays system alerts and notifications"
        refreshControl.accessibilityLabel = "Refresh Alerts"
        refreshControl.accessibilityHint = "Pull down to refresh alerts list"
    }
    
    private func authenticateUser() {
        let context = LAContext()
        var error: NSError?
        
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            Logger.shared.error("Biometric authentication not available",
                              category: .security,
                              error: error)
            return
        }
        
        context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics,
                             localizedReason: "Authenticate to view alerts") { [weak self] success, error in
            if !success {
                Logger.shared.error("Biometric authentication failed",
                                  category: .security,
                                  error: error)
                DispatchQueue.main.async {
                    self?.handleAuthenticationFailure()
                }
            }
        }
    }
    
    private func updateDataSource(with alerts: [Alert]) {
        var snapshot = NSDiffableDataSourceSnapshot<String, Alert>()
        snapshot.appendSections(["Alerts"])
        snapshot.appendItems(alerts)
        dataSource.apply(snapshot, animatingDifferences: true)
    }
    
    private func updateLoadingState(_ isLoading: Bool) {
        if isLoading {
            refreshControl.beginRefreshing()
        } else {
            refreshControl.endRefreshing()
        }
    }
    
    private func handleSecureAlertSelection(_ alert: Alert) {
        Task {
            await viewModel.acknowledgeAlert(id: alert.id)
            
            // Navigate to detail view with security context
            let detailVC = AlertDetailViewController(alert: alert,
                                                   securityContext: viewModel.securityContext)
            navigationController?.pushViewController(detailVC, animated: true)
        }
    }
    
    // MARK: - Actions
    
    @objc private func handleRefresh() {
        Task {
            await viewModel.fetchAlerts()
        }
    }
    
    @objc private func showFilterOptions() {
        let alertController = UIAlertController(title: "Filter Alerts",
                                              message: nil,
                                              preferredStyle: .actionSheet)
        
        AlertSeverity.allCases.forEach { severity in
            let action = UIAlertAction(title: severity.description,
                                     style: .default) { [weak self] _ in
                self?.filterAlerts(by: severity)
            }
            alertController.addAction(action)
        }
        
        let cancelAction = UIAlertAction(title: "Cancel",
                                       style: .cancel,
                                       handler: nil)
        alertController.addAction(cancelAction)
        
        present(alertController, animated: true)
    }
    
    private func handleAuthenticationFailure() {
        let alert = UIAlertController(
            title: "Authentication Required",
            message: "Please authenticate to view alerts",
            preferredStyle: .alert
        )
        
        alert.addAction(UIAlertAction(title: "Retry",
                                    style: .default) { [weak self] _ in
            self?.authenticateUser()
        })
        
        alert.addAction(UIAlertAction(title: "Cancel",
                                    style: .cancel) { [weak self] _ in
            self?.navigationController?.popViewController(animated: true)
        })
        
        present(alert, animated: true)
    }
}

// MARK: - UITableViewDelegate

extension AlertListViewController: UITableViewDelegate {
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        
        guard let alert = dataSource.itemIdentifier(for: indexPath) else { return }
        handleSecureAlertSelection(alert)
    }
}

// MARK: - UITableViewDataSourcePrefetching

extension AlertListViewController: UITableViewDataSourcePrefetching {
    func tableView(_ tableView: UITableView, prefetchRowsAt indexPaths: [IndexPath]) {
        let maxIndex = indexPaths.map { $0.row }.max() ?? 0
        
        if maxIndex >= (currentPage + 1) * PAGINATION_PAGE_SIZE - 5 && !isLoadingMore {
            isLoadingMore = true
            currentPage += 1
            
            Task {
                await viewModel.fetchAlerts()
                isLoadingMore = false
            }
        }
    }
}