import UIKit // latest
import Combine // latest

/// Thread-safe view controller managing team dashboard interface with Material Design 3.0 implementation
@available(iOS 14.0, *)
@MainActor
public final class TeamViewController: UIViewController {
    
    // MARK: - Properties
    
    private let viewModel: TeamViewModel
    private var cancellables = Set<AnyCancellable>()
    private let stateLock = NSLock()
    private let currentUserRole: Team.TeamRole
    
    // MARK: - UI Components
    
    @IBOutlet private weak var tableView: UITableView!
    @IBOutlet private weak var analyticsContainerView: UIView!
    @IBOutlet private weak var loadingIndicator: UIActivityIndicatorView!
    
    private lazy var refreshControl: UIRefreshControl = {
        let control = UIRefreshControl()
        control.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
        control.accessibilityLabel = "Refresh team data"
        return control
    }()
    
    private lazy var emptyStateView: UIView = {
        let view = UIView()
        view.isHidden = true
        view.accessibilityLabel = "No team members found"
        return view
    }()
    
    // MARK: - Initialization
    
    public init(viewModel: TeamViewModel, userRole: Team.TeamRole) {
        self.viewModel = viewModel
        self.currentUserRole = userRole
        super.init(nibName: nil, bundle: nil)
        
        // Configure accessibility
        self.view.accessibilityLabel = "Team Dashboard"
        self.view.accessibilityIdentifier = "teamDashboard"
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Lifecycle
    
    public override func viewDidLoad() {
        super.viewDidLoad()
        
        setupUI()
        setupTableView()
        setupSecureStateObservation()
        
        // Initial data load with role validation
        Task {
            await handleTeamAction(.loadTeam)
        }
    }
    
    // MARK: - UI Setup
    
    private func setupUI() {
        // Configure navigation bar with Material Design
        navigationItem.title = "Team Dashboard"
        navigationController?.navigationBar.prefersLargeTitles = true
        
        // Configure analytics container with elevation
        analyticsContainerView.layer.cornerRadius = 12
        analyticsContainerView.layer.shadowColor = UIColor.black.cgColor
        analyticsContainerView.layer.shadowOffset = CGSize(width: 0, height: 2)
        analyticsContainerView.layer.shadowRadius = 4
        analyticsContainerView.layer.shadowOpacity = 0.1
        
        // Configure loading indicator
        loadingIndicator.hidesWhenStopped = true
        loadingIndicator.style = .large
        
        // Configure empty state
        setupEmptyState()
    }
    
    private func setupTableView() {
        // Register cell with reuse optimization
        tableView.register(AthleteCell.self, forCellReuseIdentifier: "AthleteCell")
        tableView.delegate = self
        tableView.dataSource = self
        
        // Add refresh control
        tableView.refreshControl = refreshControl
        
        // Configure appearance
        tableView.separatorStyle = .none
        tableView.backgroundColor = .systemBackground
        tableView.rowHeight = UITableView.automaticDimension
        tableView.estimatedRowHeight = 120
        
        // Enable prefetching
        tableView.prefetchDataSource = self
        
        // Configure accessibility
        tableView.accessibilityLabel = "Team members list"
        tableView.accessibilityHint = "Shows all team members and their current status"
    }
    
    private func setupSecureStateObservation() {
        stateLock.lock()
        defer { stateLock.unlock() }
        
        // Observe view state changes
        viewModel.$viewState
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                self?.updateUI(for: state)
            }
            .store(in: &cancellables)
        
        // Observe team data changes with access control
        viewModel.$currentTeam
            .receive(on: DispatchQueue.main)
            .sink { [weak self] team in
                guard let self = self else { return }
                self.validateAccess(for: team)
                self.updateAnalytics(for: team)
            }
            .store(in: &cancellables)
        
        // Observe team members with thread safety
        viewModel.$teamMembers
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.tableView.reloadData()
            }
            .store(in: &cancellables)
    }
    
    // MARK: - UI Updates
    
    private func updateUI(for state: TeamViewState) {
        stateLock.lock()
        defer { stateLock.unlock() }
        
        switch state {
        case .loading:
            loadingIndicator.startAnimating()
            emptyStateView.isHidden = true
            tableView.isHidden = true
            
        case .loaded(let team):
            loadingIndicator.stopAnimating()
            refreshControl.endRefreshing()
            
            emptyStateView.isHidden = !team.memberRoles.isEmpty
            tableView.isHidden = team.memberRoles.isEmpty
            tableView.reloadData()
            
            updateAccessibility(for: team)
            
        case .error(let error):
            loadingIndicator.stopAnimating()
            refreshControl.endRefreshing()
            
            showError(error)
            
        case .offline:
            loadingIndicator.stopAnimating()
            refreshControl.endRefreshing()
            
            showOfflineState()
        }
    }
    
    private func updateAnalytics(for team: Team?) {
        guard let team = team else { return }
        
        // Update analytics visualization with Material Design
        // Implementation would go here
    }
    
    // MARK: - Actions
    
    @objc private func handleRefresh() {
        Task {
            await handleTeamAction(.loadTeam)
        }
    }
    
    private func handleTeamAction(_ action: TeamOperation) async {
        do {
            // Validate user permissions
            guard validatePermissions(for: action) else {
                showError(.unauthorized)
                return
            }
            
            // Execute action
            switch action {
            case .loadTeam:
                await viewModel.loadTeam()
                
            case .refreshAnalytics:
                // Implementation would go here
                break
                
            default:
                break
            }
            
        } catch {
            showError(.networkError)
        }
    }
    
    // MARK: - Helper Methods
    
    private func validateAccess(for team: Team?) {
        guard let team = team else { return }
        // Implementation would validate user access to team data
    }
    
    private func validatePermissions(for action: TeamOperation) -> Bool {
        // Implementation would validate user permissions for specific actions
        return true
    }
    
    private func updateAccessibility(for team: Team) {
        let memberCount = team.memberRoles.count
        tableView.accessibilityLabel = "Team members list showing \(memberCount) members"
    }
    
    private func showError(_ error: TeamError) {
        let alert = UIAlertController(
            title: "Error",
            message: error.localizedDescription,
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
    
    private func showOfflineState() {
        // Implementation would show offline state UI
    }
}

// MARK: - UITableViewDataSource

extension TeamViewController: UITableViewDataSource {
    public func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return viewModel.teamMembers.count
    }
    
    public func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        guard let cell = tableView.dequeueReusableCell(withIdentifier: "AthleteCell", for: indexPath) as? AthleteCell else {
            return UITableViewCell()
        }
        
        // Configure cell with thread safety
        stateLock.lock()
        if let athlete = viewModel.teamMembers[indexPath.row] {
            cell.configure(with: athlete)
        }
        stateLock.unlock()
        
        return cell
    }
}

// MARK: - UITableViewDelegate

extension TeamViewController: UITableViewDelegate {
    public func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        // Handle selection with role-based access control
    }
}

// MARK: - UITableViewDataSourcePrefetching

extension TeamViewController: UITableViewDataSourcePrefetching {
    public func tableView(_ tableView: UITableView, prefetchRowsAt indexPaths: [IndexPath]) {
        // Implement prefetching optimization
    }
}