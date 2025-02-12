#!/usr/bin/env bash

# Monitoring Setup Script for Smart Apparel Platform
# Version: 1.0.0
# This script sets up and configures the monitoring stack with enhanced validation,
# security, and high availability features.

set -euo pipefail
IFS=$'\n\t'

# Global Variables
readonly MONITORING_NAMESPACE="monitoring"
readonly PROMETHEUS_VERSION="2.45.0"
readonly GRAFANA_VERSION="9.5.0"
readonly JAEGER_VERSION="1.45.0"
readonly RETENTION_DAYS="30"
readonly SCRAPE_INTERVAL="15s"
readonly HA_REPLICA_COUNT="3"
readonly BACKUP_RETENTION="90d"
readonly ALERT_SEVERITY_LEVELS="critical,warning,info"

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Please install kubectl v1.27+"
        exit 1
    fi
    
    # Check kubectl version
    kubectl_version=$(kubectl version --client -o json | jq -r '.clientVersion.gitVersion')
    if [[ ! "$kubectl_version" =~ v1\.[2-9][7-9]\. ]]; then
        log_warn "kubectl version $kubectl_version may not be compatible. Recommended: v1.27+"
    fi
    
    # Check helm
    if ! command -v helm &> /dev/null; then
        log_error "helm not found. Please install helm v3.12+"
        exit 1
    }
    
    # Check cluster access
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Unable to access cluster. Please check your kubeconfig"
        exit 1
    }
    
    # Verify storage class
    if ! kubectl get storageclass fast &> /dev/null; then
        log_error "Required storage class 'fast' not found"
        exit 1
    }
    
    log_info "Prerequisites check completed successfully"
    return 0
}

# Setup monitoring namespace with enhanced security
setup_monitoring_namespace() {
    log_info "Setting up monitoring namespace..."
    
    # Create namespace if it doesn't exist
    if ! kubectl get namespace "$MONITORING_NAMESPACE" &> /dev/null; then
        kubectl create namespace "$MONITORING_NAMESPACE"
    fi
    
    # Apply resource quotas
    kubectl apply -f - <<EOF
apiVersion: v1
kind: ResourceQuota
metadata:
  name: monitoring-quota
  namespace: $MONITORING_NAMESPACE
spec:
  hard:
    requests.cpu: "8"
    requests.memory: "16Gi"
    limits.cpu: "8"
    limits.memory: "16Gi"
    pods: "20"
EOF
    
    # Apply network policies
    kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: monitoring-network-policy
  namespace: $MONITORING_NAMESPACE
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: backend
    - namespaceSelector:
        matchLabels:
          name: frontend
EOF
    
    log_info "Monitoring namespace setup completed"
}

# Deploy Prometheus with HA configuration
deploy_prometheus() {
    log_info "Deploying Prometheus..."
    
    # Create Prometheus configuration
    kubectl apply -f infrastructure/kubernetes/monitoring/prometheus.yaml
    
    # Wait for Prometheus deployment
    kubectl rollout status statefulset/prometheus -n "$MONITORING_NAMESPACE" --timeout=300s
    
    # Verify Prometheus health
    local prometheus_pod
    prometheus_pod=$(kubectl get pods -n "$MONITORING_NAMESPACE" -l app=prometheus -o jsonpath='{.items[0].metadata.name}')
    
    if ! kubectl exec -n "$MONITORING_NAMESPACE" "$prometheus_pod" -- wget -qO- localhost:9090/-/healthy; then
        log_error "Prometheus health check failed"
        exit 1
    fi
    
    log_info "Prometheus deployment completed successfully"
}

# Deploy Grafana with comprehensive dashboard setup
deploy_grafana() {
    log_info "Deploying Grafana..."
    
    # Create Grafana secrets
    kubectl create secret generic grafana-secrets \
        --namespace="$MONITORING_NAMESPACE" \
        --from-literal=admin-password="$(openssl rand -base64 32)" \
        --from-literal=secret-key="$(openssl rand -base64 32)" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply Grafana configuration
    kubectl apply -f infrastructure/kubernetes/monitoring/grafana.yaml
    
    # Wait for Grafana deployment
    kubectl rollout status deployment/grafana -n "$MONITORING_NAMESPACE" --timeout=300s
    
    log_info "Grafana deployment completed successfully"
}

# Deploy Jaeger with optimized storage
deploy_jaeger() {
    log_info "Deploying Jaeger..."
    
    # Create Jaeger credentials
    kubectl create secret generic jaeger-es-creds \
        --namespace="$MONITORING_NAMESPACE" \
        --from-literal=username="jaeger" \
        --from-literal=password="$(openssl rand -base64 32)" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply Jaeger configuration
    kubectl apply -f infrastructure/kubernetes/monitoring/jaeger.yaml
    
    # Wait for Jaeger deployment
    kubectl rollout status deployment/jaeger -n "$MONITORING_NAMESPACE" --timeout=300s
    
    log_info "Jaeger deployment completed successfully"
}

# Configure alerting rules and notification channels
configure_alerting() {
    log_info "Configuring alerting..."
    
    # Apply alerting rules
    kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: critical-alerts
  namespace: $MONITORING_NAMESPACE
spec:
  groups:
  - name: critical
    rules:
    - alert: HighLatency
      expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.1
      for: 5m
      labels:
        severity: critical
      annotations:
        description: "High latency detected"
    - alert: LowUptime
      expr: avg(up{job="system-metrics"}) < 0.999
      for: 5m
      labels:
        severity: critical
      annotations:
        description: "System uptime below 99.9%"
EOF
    
    log_info "Alerting configuration completed"
}

# Verify monitoring stack functionality
verify_monitoring_stack() {
    log_info "Verifying monitoring stack..."
    
    # Check all components are running
    local components=("prometheus" "grafana" "jaeger")
    for component in "${components[@]}"; do
        if ! kubectl get pods -n "$MONITORING_NAMESPACE" -l app="$component" | grep -q "Running"; then
            log_error "$component is not running"
            return 1
        fi
    done
    
    # Verify metrics collection
    if ! curl -s "http://prometheus:9090/api/v1/query?query=up" | grep -q "success"; then
        log_warn "Metrics collection may not be working properly"
    fi
    
    log_info "Monitoring stack verification completed"
    return 0
}

# Main setup function
main() {
    log_info "Starting monitoring stack setup..."
    
    check_prerequisites || exit 1
    setup_monitoring_namespace || exit 1
    deploy_prometheus || exit 1
    deploy_grafana || exit 1
    deploy_jaeger || exit 1
    configure_alerting || exit 1
    verify_monitoring_stack || exit 1
    
    log_info "Monitoring stack setup completed successfully"
}

# Execute main function
main "$@"