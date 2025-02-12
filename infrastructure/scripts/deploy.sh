#!/bin/bash

# Smart Apparel System Deployment Script
# Version: 1.0.0
# Dependencies:
# - kubectl v1.27+
# - aws-cli v2.0+

set -euo pipefail

# Global Configuration
readonly ENVIRONMENTS=("development" "staging" "production")
readonly KUBECTL_TIMEOUT="300s"
readonly DEPLOYMENT_NAMESPACE="smart-apparel"
readonly HEALTH_CHECK_RETRIES=5
readonly MAX_SURGE="25%"
readonly MAX_UNAVAILABLE="0"
readonly ROLLBACK_THRESHOLD=3

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

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

# Environment validation
validate_environment() {
    local environment=$1
    local config_file=$2

    if [[ ! " ${ENVIRONMENTS[@]} " =~ " ${environment} " ]]; then
        log_error "Invalid environment: ${environment}"
        exit 1
    }

    # Verify AWS credentials and configuration
    if ! aws sts get-caller-identity &>/dev/null; then
        log_error "AWS credentials not configured properly"
        exit 1
    }

    # Verify Kubernetes cluster access
    if ! kubectl cluster-info &>/dev/null; then
        log_error "Cannot access Kubernetes cluster"
        exit 1
    }

    # Verify required namespaces
    kubectl get namespace ${DEPLOYMENT_NAMESPACE} &>/dev/null || \
        kubectl create namespace ${DEPLOYMENT_NAMESPACE}

    # Verify ConfigMaps and Secrets
    if ! kubectl get configmap production-config -n ${DEPLOYMENT_NAMESPACE} &>/dev/null; then
        log_error "Required ConfigMap 'production-config' not found"
        exit 1
    }

    return 0
}

# Deploy backend services
deploy_backend() {
    local environment=$1
    local version_tag=$2

    log_info "Deploying backend services for ${environment} environment"

    # Apply resource quotas and limits
    kubectl apply -f ../kubernetes/config/${environment}.yaml

    # Deploy API servers
    kubectl apply -f ../kubernetes/services/backend.yaml
    kubectl set image deployment/api-deployment \
        api-server=smart-apparel/api:${version_tag} \
        -n ${DEPLOYMENT_NAMESPACE}

    # Configure autoscaling
    kubectl apply -f ../kubernetes/services/api-gateway.yaml

    # Deploy worker nodes
    kubectl apply -f ../kubernetes/services/kafka.yaml

    # Wait for deployments to be ready
    kubectl rollout status deployment/api-deployment \
        -n ${DEPLOYMENT_NAMESPACE} \
        --timeout=${KUBECTL_TIMEOUT}

    return 0
}

# Deploy frontend
deploy_frontend() {
    local environment=$1
    local version_tag=$2

    log_info "Deploying frontend for ${environment} environment"

    # Deploy web application
    kubectl apply -f ../kubernetes/services/web.yaml
    kubectl set image deployment/web-deployment \
        web=smartapparel/web:${version_tag} \
        -n ${DEPLOYMENT_NAMESPACE}

    # Wait for deployment to be ready
    kubectl rollout status deployment/web-deployment \
        -n ${DEPLOYMENT_NAMESPACE} \
        --timeout=${KUBECTL_TIMEOUT}

    return 0
}

# Health check function
health_check() {
    local service_name=$1
    local namespace=$2
    local retry_count=0

    while [ $retry_count -lt ${HEALTH_CHECK_RETRIES} ]; do
        if kubectl get pods -n ${namespace} -l app=${service_name} \
            -o jsonpath='{.items[*].status.containerStatuses[*].ready}' | grep -q "true"; then
            
            # Verify endpoints
            if kubectl get endpoints ${service_name} -n ${namespace} \
                -o jsonpath='{.subsets[*].addresses[*]}' | grep -q "ip"; then
                log_info "Health check passed for ${service_name}"
                return 0
            fi
        fi

        log_warn "Health check attempt ${retry_count} failed for ${service_name}"
        ((retry_count++))
        sleep 10
    done

    log_error "Health check failed for ${service_name}"
    return 1
}

# Rollback function
rollback() {
    local service_name=$1
    local previous_version=$2
    local namespace=$3

    log_warn "Initiating rollback for ${service_name} to version ${previous_version}"

    # Record current state
    kubectl get deployment ${service_name} \
        -n ${namespace} \
        -o yaml > /tmp/${service_name}_failed_deployment.yaml

    # Perform rollback
    kubectl rollout undo deployment/${service_name} \
        -n ${namespace} \
        --to-revision=${previous_version}

    # Verify rollback
    if ! kubectl rollout status deployment/${service_name} \
        -n ${namespace} \
        --timeout=${KUBECTL_TIMEOUT}; then
        log_error "Rollback failed for ${service_name}"
        exit 1
    fi

    log_info "Rollback completed successfully for ${service_name}"
    return 0
}

# Main deployment function
main() {
    if [ "$#" -lt 2 ]; then
        log_error "Usage: $0 <environment> <version_tag>"
        exit 1
    fi

    local environment=$1
    local version_tag=$2

    log_info "Starting deployment for ${environment} environment with version ${version_tag}"

    # Validate environment
    validate_environment ${environment} || exit 1

    # Deploy backend services
    if ! deploy_backend ${environment} ${version_tag}; then
        log_error "Backend deployment failed"
        rollback "api-deployment" "1" ${DEPLOYMENT_NAMESPACE}
        exit 1
    fi

    # Deploy frontend
    if ! deploy_frontend ${environment} ${version_tag}; then
        log_error "Frontend deployment failed"
        rollback "web-deployment" "1" ${DEPLOYMENT_NAMESPACE}
        exit 1
    fi

    # Perform health checks
    if ! health_check "api-deployment" ${DEPLOYMENT_NAMESPACE}; then
        log_error "API health check failed"
        rollback "api-deployment" "1" ${DEPLOYMENT_NAMESPACE}
        exit 1
    fi

    if ! health_check "web-deployment" ${DEPLOYMENT_NAMESPACE}; then
        log_error "Web health check failed"
        rollback "web-deployment" "1" ${DEPLOYMENT_NAMESPACE}
        exit 1
    fi

    log_info "Deployment completed successfully"
    return 0
}

# Execute main function with provided arguments
main "$@"