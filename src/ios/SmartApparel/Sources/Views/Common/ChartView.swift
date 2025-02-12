//
// ChartView.swift
// SmartApparel
//
// High-performance chart visualization component with real-time updates
// Charts version: 4.1.0
//

import UIKit
import Charts // v4.1.0

@IBDesignable
public class ChartView: UIView {
    
    // MARK: - Types
    
    public enum ChartType {
        case lineGraph
        case heatMap
        case performanceTrend
    }
    
    public struct HeatMapConfig {
        let colorGradient: [UIColor]
        let interpolationPoints: Int
        let updateInterval: TimeInterval
        let binSize: Int
        
        public static let `default` = HeatMapConfig(
            colorGradient: [.blue, .green, .yellow, .red],
            interpolationPoints: 100,
            updateInterval: 0.1, // 100ms for real-time updates
            binSize: 32
        )
    }
    
    public struct UpdateOptions {
        let animated: Bool
        let duration: TimeInterval
        let easingOption: ChartEasingOption
        
        public static let `default` = UpdateOptions(
            animated: true,
            duration: 0.1,
            easingOption: .easeInOutCubic
        )
    }
    
    // MARK: - Properties
    
    private let lineChartView: LineChartView = {
        let chart = LineChartView()
        chart.noDataText = "No data available"
        chart.dragEnabled = true
        chart.setScaleEnabled(true)
        chart.pinchZoomEnabled = true
        chart.drawGridBackgroundEnabled = false
        chart.legend.enabled = true
        chart.animate(xAxisDuration: 0.1)
        return chart
    }()
    
    private let heatMapView: HeatMapView = {
        let heatMap = HeatMapView()
        heatMap.minColor = .blue
        heatMap.maxColor = .red
        heatMap.interpolationEnabled = true
        heatMap.drawBordersEnabled = false
        return heatMap
    }()
    
    private let containerStack: UIStackView = {
        let stack = UIStackView()
        stack.axis = .vertical
        stack.distribution = .fill
        stack.alignment = .fill
        stack.spacing = 8
        return stack
    }()
    
    private var currentChartType: ChartType = .lineGraph
    private let formatter = DataFormatter()
    private let updateQueue = DispatchQueue(label: "com.smartapparel.chartview.update", qos: .userInteractive)
    private let displayLink: CADisplayLink
    private var dataBuffer: [ChartDataEntry] = []
    private let dataLock = NSLock()
    
    // MARK: - Initialization
    
    override public init(frame: CGRect) {
        displayLink = CADisplayLink(target: self, selector: #selector(displayLinkUpdate))
        super.init(frame: frame)
        setupChartView()
    }
    
    required init?(coder: NSCoder) {
        displayLink = CADisplayLink(target: self, selector: #selector(displayLinkUpdate))
        super.init(coder: coder)
        setupChartView()
    }
    
    deinit {
        displayLink.invalidate()
    }
    
    // MARK: - Setup
    
    private func setupChartView() {
        // Configure container stack
        addSubview(containerStack.anchor())
        containerStack.fillSuperview()
        
        // Add chart views
        containerStack.addArrangedSubview(lineChartView.anchor())
        containerStack.addArrangedSubview(heatMapView.anchor())
        
        // Configure display link for smooth updates
        displayLink.preferredFramesPerSecond = 60
        displayLink.add(to: .main, forMode: .common)
        
        // Configure accessibility
        isAccessibilityElement = true
        accessibilityLabel = "Performance Chart"
        accessibilityTraits = .updatesFrequently
        
        // Setup memory warning observer
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleMemoryWarning),
            name: UIApplication.didReceiveMemoryWarningNotification,
            object: nil
        )
        
        // Initial view setup
        updateChartVisibility()
    }
    
    // MARK: - Public Methods
    
    public func updateChartData(_ values: [Double], type: ChartType, options: UpdateOptions = .default) {
        dataLock.lock()
        defer { dataLock.unlock() }
        
        updateQueue.async { [weak self] in
            guard let self = self else { return }
            
            // Process data based on chart type
            switch type {
            case .lineGraph:
                self.updateLineChart(values, options: options)
            case .heatMap:
                self.updateHeatMap(values, options: options)
            case .performanceTrend:
                self.updatePerformanceTrend(values, options: options)
            }
            
            // Update chart visibility on main thread
            DispatchQueue.main.async {
                self.currentChartType = type
                self.updateChartVisibility()
            }
        }
    }
    
    public func configureHeatMap(_ config: HeatMapConfig = .default) {
        updateQueue.async { [weak self] in
            guard let self = self else { return }
            
            DispatchQueue.main.async {
                self.heatMapView.colors = config.colorGradient
                self.heatMapView.interpolationPoints = config.interpolationPoints
                self.heatMapView.updateInterval = config.updateInterval
                self.heatMapView.binSize = config.binSize
            }
        }
    }
    
    // MARK: - Private Methods
    
    private func updateLineChart(_ values: [Double], options: UpdateOptions) {
        let entries = values.enumerated().map { ChartDataEntry(x: Double($0), y: $1) }
        
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            let dataSet = LineChartDataSet(entries: entries, label: "Performance")
            dataSet.mode = .cubicBezier
            dataSet.drawCirclesEnabled = false
            dataSet.lineWidth = 2
            dataSet.setColor(.systemBlue)
            dataSet.fillAlpha = 0.3
            dataSet.drawFilledEnabled = true
            
            let data = LineChartData(dataSet: dataSet)
            self.lineChartView.data = data
            
            if options.animated {
                self.lineChartView.animate(xAxisDuration: options.duration, easingOption: options.easingOption)
            }
        }
    }
    
    private func updateHeatMap(_ values: [Double], options: UpdateOptions) {
        guard let formattedData = try? formatter.formatMetrics(["heatmap": values.reduce(0, +)]) else {
            return
        }
        
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            self.heatMapView.updateData(values, animated: options.animated)
        }
    }
    
    private func updatePerformanceTrend(_ values: [Double], options: UpdateOptions) {
        let entries = values.enumerated().map { ChartDataEntry(x: Double($0), y: $1) }
        
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            let dataSet = LineChartDataSet(entries: entries, label: "Trend")
            dataSet.mode = .linear
            dataSet.drawCirclesEnabled = true
            dataSet.circleRadius = 3
            dataSet.lineWidth = 2
            dataSet.setColor(.systemGreen)
            
            let data = LineChartData(dataSet: dataSet)
            self.lineChartView.data = data
            
            if options.animated {
                self.lineChartView.animate(xAxisDuration: options.duration, easingOption: options.easingOption)
            }
        }
    }
    
    private func updateChartVisibility() {
        lineChartView.isHidden = currentChartType == .heatMap
        heatMapView.isHidden = currentChartType != .heatMap
    }
    
    @objc private func displayLinkUpdate() {
        // Smooth animation updates handled by CADisplayLink
        if !dataLock.try() { return }
        defer { dataLock.unlock() }
        
        // Update chart data if needed
        if !dataBuffer.isEmpty {
            // Process buffered data
            dataBuffer.removeAll()
        }
    }
    
    @objc private func handleMemoryWarning() {
        dataLock.lock()
        defer { dataLock.unlock() }
        
        // Clear data buffer on memory warning
        dataBuffer.removeAll()
    }
}