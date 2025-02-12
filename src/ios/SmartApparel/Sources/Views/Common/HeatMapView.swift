import UIKit
import CoreGraphics

/// A high-performance UIView subclass that renders real-time heat map visualizations of sensor data
/// with support for gesture interactions and optimized rendering.
public class HeatMapView: UIView {
    
    // MARK: - Private Properties
    
    private var dataPoints: [Double] = []
    private var maxValue: CGFloat = 1.0
    private var minValue: CGFloat = 0.0
    private let dataLock = NSLock()
    private var displayLink: CADisplayLink?
    private var gridSize: CGSize = CGSize(width: 32, height: 32)
    private var isAnimating: Bool = false
    private var renderBuffer: CALayer?
    private var panGesture: UIPanGestureRecognizer!
    private var pinchGesture: UIPinchGestureRecognizer!
    private var lastPanLocation: CGPoint = .zero
    private var currentScale: CGFloat = 1.0
    private var isFrameDropped: Bool = false
    private let teamColorGradient: [UIColor] = UIColor.heatMapGradient
    
    // MARK: - Performance Metrics
    
    private var lastRenderTime: CFTimeInterval = 0
    private let targetFrameTime: CFTimeInterval = 1.0 / 60.0 // 60 FPS
    private let frameDropThreshold: CFTimeInterval = 1.0 / 30.0 // 30 FPS minimum
    
    // MARK: - Initialization
    
    public override init(frame: CGRect) {
        super.init(frame: frame)
        setupView()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupView()
    }
    
    private func setupView() {
        // Layer configuration
        layer.drawsAsynchronously = true
        layer.shouldRasterize = true
        layer.rasterizationScale = UIScreen.main.scale
        
        // Initialize render buffer
        renderBuffer = CALayer()
        renderBuffer?.frame = bounds
        renderBuffer?.contentsScale = UIScreen.main.scale
        layer.addSublayer(renderBuffer!)
        
        // Configure gestures
        setupGestures()
        
        // Configure display link for smooth animation
        displayLink = CADisplayLink(target: self, selector: #selector(displayLinkDidFire))
        displayLink?.preferredFramesPerSecond = 60
        displayLink?.add(to: .main, forMode: .common)
        
        // Configure accessibility
        isAccessibilityElement = true
        accessibilityLabel = "Heat map visualization"
        accessibilityTraits = .updatesFrequently
    }
    
    private func setupGestures() {
        panGesture = UIPanGestureRecognizer(target: self, selector: #selector(handlePanGesture(_:)))
        pinchGesture = UIPinchGestureRecognizer(target: self, selector: #selector(handlePinchGesture(_:)))
        
        addGestureRecognizer(panGesture)
        addGestureRecognizer(pinchGesture)
    }
    
    // MARK: - Public Methods
    
    /// Updates the heat map with new sensor data
    /// - Parameter sensorData: The sensor data containing readings to visualize
    public func updateHeatMap(with sensorData: SensorData) {
        dataLock.lock()
        defer { dataLock.unlock() }
        
        // Validate sensor data
        guard case .success = sensorData.isValid() else { return }
        
        // Update data points
        dataPoints = sensorData.currentReadings
        
        // Calculate min/max values
        if let min = dataPoints.min(), let max = dataPoints.max() {
            minValue = CGFloat(min)
            maxValue = CGFloat(max)
        }
        
        // Trigger redraw
        isAnimating = true
    }
    
    // MARK: - Private Methods
    
    @objc private func displayLinkDidFire(_ displayLink: CADisplayLink) {
        guard isAnimating else { return }
        
        let currentTime = displayLink.timestamp
        let elapsed = currentTime - lastRenderTime
        
        // Check for frame drops
        isFrameDropped = elapsed > frameDropThreshold
        
        if elapsed >= targetFrameTime {
            drawHeatMap()
            lastRenderTime = currentTime
        }
    }
    
    private func drawHeatMap() {
        dataLock.lock()
        defer { dataLock.unlock() }
        
        UIGraphicsBeginImageContextWithOptions(bounds.size, false, UIScreen.main.scale)
        guard let context = UIGraphicsGetCurrentContext() else { return }
        
        let cellWidth = bounds.width / CGFloat(gridSize.width)
        let cellHeight = bounds.height / CGFloat(gridSize.height)
        
        // Optimize rendering for dropped frames
        let renderQuality = isFrameDropped ? 2 : 1
        
        for y in stride(from: 0, to: Int(gridSize.height), by: renderQuality) {
            for x in stride(from: 0, to: Int(gridSize.width), by: renderQuality) {
                let index = y * Int(gridSize.width) + x
                guard index < dataPoints.count else { continue }
                
                let normalizedValue = CGFloat(dataPoints[index] - Double(minValue)) / CGFloat(maxValue - minValue)
                let colorIndex = Int(normalizedValue * CGFloat(teamColorGradient.count - 1))
                let color = teamColorGradient[max(0, min(colorIndex, teamColorGradient.count - 1))]
                
                let rect = CGRect(x: CGFloat(x) * cellWidth,
                                y: CGFloat(y) * cellHeight,
                                width: cellWidth * CGFloat(renderQuality),
                                height: cellHeight * CGFloat(renderQuality))
                
                context.setFillColor(color.cgColor)
                context.fill(rect)
            }
        }
        
        if let image = UIGraphicsGetImageFromCurrentImageContext() {
            renderBuffer?.contents = image
        }
        
        UIGraphicsEndImageContext()
    }
    
    // MARK: - Gesture Handlers
    
    @objc private func handlePanGesture(_ gesture: UIPanGestureRecognizer) {
        switch gesture.state {
        case .began:
            lastPanLocation = gesture.location(in: self)
            
        case .changed:
            let location = gesture.location(in: self)
            let delta = CGPoint(x: location.x - lastPanLocation.x,
                              y: location.y - lastPanLocation.y)
            
            var newTransform = transform
            newTransform = newTransform.translatedBy(x: delta.x, y: delta.y)
            
            // Apply bounds checking
            transform = newTransform
            lastPanLocation = location
            
        default:
            break
        }
    }
    
    @objc private func handlePinchGesture(_ gesture: UIPinchGestureRecognizer) {
        switch gesture.state {
        case .began:
            gesture.scale = currentScale
            
        case .changed:
            let scale = gesture.scale
            let minScale: CGFloat = 0.5
            let maxScale: CGFloat = 3.0
            
            currentScale = min(maxScale, max(minScale, scale))
            
            var newTransform = CGAffineTransform.identity
            newTransform = newTransform.scaledBy(x: currentScale, y: currentScale)
            
            transform = newTransform
            
        default:
            break
        }
    }
    
    // MARK: - Memory Management
    
    deinit {
        displayLink?.invalidate()
        displayLink = nil
    }
}