import UIKit

// MARK: - UIView Layout Extension
extension UIView {
    
    /// Prepares view for Auto Layout by disabling translatesAutoresizingMaskIntoConstraints
    /// and returns self for method chaining
    /// - Returns: Self for method chaining
    @discardableResult
    func anchor() -> UIView {
        assert(Thread.isMainThread, "UI updates must be performed on main thread")
        translatesAutoresizingMaskIntoConstraints = false
        return self
    }
    
    /// Pins all edges of the view to its superview with optional padding
    /// - Parameter padding: The padding to apply to each edge (default: .zero)
    func fillSuperview(padding: UIEdgeInsets = .zero) {
        assert(Thread.isMainThread, "UI updates must be performed on main thread")
        guard let superview = superview else {
            assertionFailure("View must have a superview to fill")
            return
        }
        
        translatesAutoresizingMaskIntoConstraints = false
        
        let constraints = [
            leadingAnchor.constraint(equalTo: superview.leadingAnchor, constant: padding.left),
            trailingAnchor.constraint(equalTo: superview.trailingAnchor, constant: -padding.right),
            topAnchor.constraint(equalTo: superview.topAnchor, constant: padding.top),
            bottomAnchor.constraint(equalTo: superview.bottomAnchor, constant: -padding.bottom)
        ]
        
        NSLayoutConstraint.activate(constraints)
    }
    
    /// Centers the view in its superview both horizontally and vertically
    func centerInSuperview() {
        assert(Thread.isMainThread, "UI updates must be performed on main thread")
        guard let superview = superview else {
            assertionFailure("View must have a superview to center")
            return
        }
        
        translatesAutoresizingMaskIntoConstraints = false
        
        let constraints = [
            centerXAnchor.constraint(equalTo: superview.centerXAnchor),
            centerYAnchor.constraint(equalTo: superview.centerYAnchor)
        ]
        
        NSLayoutConstraint.activate(constraints)
    }
    
    /// Sets fixed width and height constraints for the view
    /// - Parameter size: The desired size (width and height) for the view
    func constrainSize(_ size: CGSize) {
        assert(Thread.isMainThread, "UI updates must be performed on main thread")
        translatesAutoresizingMaskIntoConstraints = false
        
        let constraints = [
            widthAnchor.constraint(equalToConstant: size.width),
            heightAnchor.constraint(equalToConstant: size.height)
        ]
        
        NSLayoutConstraint.activate(constraints)
    }
    
    /// Sets a fixed width constraint for the view
    /// - Parameter width: The desired width for the view
    func constrainWidth(_ width: CGFloat) {
        assert(Thread.isMainThread, "UI updates must be performed on main thread")
        translatesAutoresizingMaskIntoConstraints = false
        
        widthAnchor.constraint(equalToConstant: width).isActive = true
    }
    
    /// Sets a fixed height constraint for the view
    /// - Parameter height: The desired height for the view
    func constrainHeight(_ height: CGFloat) {
        assert(Thread.isMainThread, "UI updates must be performed on main thread")
        translatesAutoresizingMaskIntoConstraints = false
        
        heightAnchor.constraint(equalToConstant: height).isActive = true
    }
    
    /// Pins one edge of the view to a specified edge of another view with an optional constant
    /// - Parameters:
    ///   - otherView: The view to pin to
    ///   - edge: The edge to pin (e.g. .top, .leading, etc.)
    ///   - constant: The constant offset to apply (default: 0)
    func pinToEdge(_ otherView: UIView, edge: NSLayoutConstraint.Attribute, constant: CGFloat = 0) {
        assert(Thread.isMainThread, "UI updates must be performed on main thread")
        translatesAutoresizingMaskIntoConstraints = false
        
        let constraint = NSLayoutConstraint(
            item: self,
            attribute: edge,
            relatedBy: .equal,
            toItem: otherView,
            attribute: edge,
            multiplier: 1.0,
            constant: constant
        )
        
        constraint.isActive = true
    }
}