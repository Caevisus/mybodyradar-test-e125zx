import UIKit // latest
import Combine // latest
import LocalAuthentication // latest

/// View controller managing user settings and preferences with enhanced security and accessibility features
@MainActor
final class SettingsViewController: UIViewController {
    
    // MARK: - Types
    
    private enum SettingsSection: Int, CaseIterable {
        case profile
        case notifications
        case sensors
        case privacy
        case about
        case security
        
        var title: String {
            switch self {
            case .profile: return "Profile"
            case .notifications: return "Notifications"
            case .sensors: return "Sensor Configuration"
            case .privacy: return "Privacy & Data Sharing"
            case .about: return "About"
            case .security: return "Security Settings"
            }
        }
    }
    
    // MARK: - Properties
    
    private let tableView: UITableView = {
        let table = UITableView(frame: .zero, style: .insetGrouped)
        table.backgroundColor = .systemBackground
        table.separatorStyle = .singleLine
        table.rowHeight = UITableView.automaticDimension
        table.estimatedRowHeight = 60
        return table
    }()
    
    private let loadingView: UIActivityIndicatorView = {
        let view = UIActivityIndicatorView(style: .large)
        view.hidesWhenStopped = true
        return view
    }()
    
    private let viewModel: ProfileViewModel
    private var cancellables = Set<AnyCancellable>()
    private let accessLevel: AccessLevel
    
    // MARK: - Initialization
    
    init(accessLevel: AccessLevel) {
        self.accessLevel = accessLevel
        self.viewModel = ProfileViewModel()
        super.init(nibName: nil, bundle: nil)
        setupAccessibility()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Lifecycle Methods
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        setupBindings()
        configureTableView()
        loadSettings()
    }
    
    // MARK: - Private Methods
    
    private func setupUI() {
        title = "Settings"
        view.backgroundColor = .systemBackground
        
        view.addSubview(tableView)
        view.addSubview(loadingView)
        
        tableView.translatesAutoresizingMaskIntoConstraints = false
        loadingView.translatesAutoresizingMaskIntoConstraints = false
        
        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            loadingView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            loadingView.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
    }
    
    private func setupBindings() {
        viewModel.$viewState
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                self?.handleViewState(state)
            }
            .store(in: &cancellables)
    }
    
    private func configureTableView() {
        tableView.delegate = self
        tableView.dataSource = self
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "SettingsCell")
    }
    
    private func loadSettings() {
        loadingView.startAnimating()
        viewModel.loadUserProfile()
    }
    
    private func handleViewState(_ state: ProfileViewState) {
        switch state {
        case .loading:
            loadingView.startAnimating()
            tableView.isHidden = true
        case .loaded:
            loadingView.stopAnimating()
            tableView.isHidden = false
            tableView.reloadData()
        case .error(let error):
            loadingView.stopAnimating()
            presentError(error)
        }
    }
    
    private func presentError(_ error: ProfileError) {
        let alert = UIAlertController(
            title: "Error",
            message: error.localizedDescription,
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
    
    private func setupAccessibility() {
        // Configure accessibility for the view controller
        view.accessibilityLabel = "Settings Screen"
        view.accessibilityHint = "Configure application settings and preferences"
        
        // Configure minimum touch targets for accessibility
        let minTargetSize = CGSize(
            width: AppConstants.UI_CONFIG.MINIMUM_TARGET_SIZE,
            height: AppConstants.UI_CONFIG.MINIMUM_TARGET_SIZE
        )
        tableView.accessibilityFrame = UIAccessibility.convertToScreenCoordinates(
            CGRect(origin: .zero, size: minTargetSize),
            in: view
        )
    }
    
    private func authenticateAndUpdateSetting(type: String, value: Any) {
        let context = LAContext()
        var error: NSError?
        
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            presentError(.securityError)
            return
        }
        
        context.evaluatePolicy(
            .deviceOwnerAuthentication,
            localizedReason: "Authenticate to update settings"
        ) { [weak self] success, error in
            guard let self = self else { return }
            
            DispatchQueue.main.async {
                if success {
                    self.updateSetting(type: type, value: value)
                } else {
                    self.presentError(.securityError)
                }
            }
        }
    }
    
    private func updateSetting(type: String, value: Any) {
        let preferences = UserPreferences()
        viewModel.savePreferences(preferences)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    if case .failure(let error) = completion {
                        self?.presentError(error)
                    }
                },
                receiveValue: { [weak self] _ in
                    self?.tableView.reloadData()
                }
            )
            .store(in: &cancellables)
    }
}

// MARK: - UITableViewDelegate & UITableViewDataSource

extension SettingsViewController: UITableViewDelegate, UITableViewDataSource {
    func numberOfSections(in tableView: UITableView) -> Int {
        return SettingsSection.allCases.count
    }
    
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        switch SettingsSection(rawValue: section) {
        case .profile: return 3
        case .notifications: return 4
        case .sensors: return accessLevel == .athlete ? 2 : 4
        case .privacy: return 3
        case .about: return 2
        case .security: return 3
        case .none: return 0
        }
    }
    
    func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        return SettingsSection(rawValue: section)?.title
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "SettingsCell", for: indexPath)
        cell.accessoryType = .disclosureIndicator
        
        switch SettingsSection(rawValue: indexPath.section) {
        case .profile:
            configureProfileCell(cell, at: indexPath)
        case .notifications:
            configureNotificationCell(cell, at: indexPath)
        case .sensors:
            configureSensorCell(cell, at: indexPath)
        case .privacy:
            configurePrivacyCell(cell, at: indexPath)
        case .about:
            configureAboutCell(cell, at: indexPath)
        case .security:
            configureSecurityCell(cell, at: indexPath)
        case .none:
            break
        }
        
        return cell
    }
    
    private func configureProfileCell(_ cell: UITableViewCell, at indexPath: IndexPath) {
        switch indexPath.row {
        case 0:
            cell.textLabel?.text = "Personal Information"
        case 1:
            cell.textLabel?.text = "Team Membership"
        case 2:
            cell.textLabel?.text = "Display Preferences"
        default:
            break
        }
    }
    
    private func configureNotificationCell(_ cell: UITableViewCell, at indexPath: IndexPath) {
        switch indexPath.row {
        case 0:
            cell.textLabel?.text = "Alert Settings"
        case 1:
            cell.textLabel?.text = "Performance Updates"
        case 2:
            cell.textLabel?.text = "Team Notifications"
        case 3:
            cell.textLabel?.text = "Medical Alerts"
        default:
            break
        }
    }
    
    private func configureSensorCell(_ cell: UITableViewCell, at indexPath: IndexPath) {
        switch indexPath.row {
        case 0:
            cell.textLabel?.text = "Calibration Settings"
        case 1:
            cell.textLabel?.text = "Data Collection"
        case 2:
            cell.textLabel?.text = "Advanced Configuration"
        case 3:
            cell.textLabel?.text = "Maintenance"
        default:
            break
        }
    }
    
    private func configurePrivacyCell(_ cell: UITableViewCell, at indexPath: IndexPath) {
        switch indexPath.row {
        case 0:
            cell.textLabel?.text = "Data Sharing"
        case 1:
            cell.textLabel?.text = "Privacy Settings"
        case 2:
            cell.textLabel?.text = "Data Retention"
        default:
            break
        }
    }
    
    private func configureAboutCell(_ cell: UITableViewCell, at indexPath: IndexPath) {
        switch indexPath.row {
        case 0:
            cell.textLabel?.text = "Version Information"
        case 1:
            cell.textLabel?.text = "Legal & Compliance"
        default:
            break
        }
    }
    
    private func configureSecurityCell(_ cell: UITableViewCell, at indexPath: IndexPath) {
        switch indexPath.row {
        case 0:
            cell.textLabel?.text = "Authentication Settings"
        case 1:
            cell.textLabel?.text = "Biometric Security"
        case 2:
            cell.textLabel?.text = "Access Control"
        default:
            break
        }
    }
    
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        
        // Handle row selection based on section and access level
        switch SettingsSection(rawValue: indexPath.section) {
        case .security:
            authenticateAndUpdateSetting(
                type: "security",
                value: ["section": indexPath.section, "row": indexPath.row]
            )
        case .privacy:
            if accessLevel == .admin || accessLevel == .medical {
                authenticateAndUpdateSetting(
                    type: "privacy",
                    value: ["section": indexPath.section, "row": indexPath.row]
                )
            }
        default:
            updateSetting(
                type: "general",
                value: ["section": indexPath.section, "row": indexPath.row]
            )
        }
    }
}