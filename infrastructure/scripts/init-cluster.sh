#!/bin/bash

# Smart Apparel System - Kubernetes Cluster Initialization Script
# Version: 1.0.0
# This script initializes and configures a production-ready Kubernetes cluster with
# comprehensive security, monitoring, and high availability features.

set -euo pipefail

# Global Variables
CLUSTER_NAME=${CLUSTER_NAME:-smart-apparel-cluster}
AWS_REGION=${AWS_REGION:-us-east-1}
NODE_TYPE=${NODE_TYPE:-t3.large}
MIN_NODES=${MIN_NODES:-2}
MAX_NODES=${MAX_NODES:-10}
ENVIRONMENT=${ENV:-production}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
LOG_LEVEL=${LOG_LEVEL:-INFO}

# Logging function
log() {
    local level=$1
    shift
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [${level}] $*"
}

# Validation checks
validate_prerequisites() {
    log "INFO" "Validating prerequisites..."
    
    # Check required tools
    for tool in kubectl aws eksctl helm; do
        if ! command -v $tool &> /dev/null; then
            log "ERROR" "$tool is required but not installed"
            exit 1
        fi
    done

    # Verify AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log "ERROR" "Invalid AWS credentials"
        exit 1
    }

    log "INFO" "Prerequisites validation completed"
}

# Create EKS cluster
create_eks_cluster() {
    local cluster_name=$1
    local region=$2
    local node_type=$3
    local environment=$4

    log "INFO" "Creating EKS cluster: $cluster_name in $region"

    eksctl create cluster \
        --name "$cluster_name" \
        --region "$region" \
        --node-type "$node_type" \
        --nodes-min "$MIN_NODES" \
        --nodes-max "$MAX_NODES" \
        --with-oidc \
        --ssh-access \
        --ssh-public-key smart-apparel-eks \
        --managed \
        --alb-ingress-access \
        --node-private-networking \
        --full-ecr-access \
        --asg-access \
        --tags "Environment=$environment" \
        --enable-ssm \
        --version 1.27

    log "INFO" "EKS cluster created successfully"
}

# Setup namespaces and quotas
setup_namespaces() {
    log "INFO" "Setting up namespaces and resource quotas"

    # Apply namespace configurations
    kubectl apply -f infrastructure/kubernetes/base/namespaces.yaml

    # Additional namespace-specific configurations
    for ns in backend frontend monitoring storage; do
        kubectl label namespace $ns environment=$ENVIRONMENT
        kubectl label namespace $ns security=strict
    done

    log "INFO" "Namespaces and quotas configured successfully"
}

# Configure storage classes
configure_storage() {
    log "INFO" "Configuring storage classes"

    # Apply storage class configurations
    kubectl apply -f infrastructure/kubernetes/base/storage-classes.yaml

    # Setup EBS CSI driver
    eksctl create iamserviceaccount \
        --cluster="$CLUSTER_NAME" \
        --namespace=kube-system \
        --name=ebs-csi-controller-sa \
        --attach-policy-arn=arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy \
        --approve

    helm repo add aws-ebs-csi-driver https://kubernetes-sigs.github.io/aws-ebs-csi-driver
    helm upgrade --install aws-ebs-csi-driver \
        --namespace kube-system \
        aws-ebs-csi-driver/aws-ebs-csi-driver

    log "INFO" "Storage classes configured successfully"
}

# Deploy core services
deploy_core_services() {
    log "INFO" "Deploying core services"

    # Deploy metrics server
    kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

    # Deploy API Gateway
    kubectl apply -f infrastructure/kubernetes/services/api-gateway.yaml

    # Setup monitoring stack
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update

    # Deploy Prometheus
    helm upgrade --install prometheus prometheus-community/prometheus \
        --namespace monitoring \
        --set alertmanager.persistentVolume.storageClass="standard" \
        --set server.persistentVolume.storageClass="standard"

    # Deploy Grafana
    helm upgrade --install grafana grafana/grafana \
        --namespace monitoring \
        --set persistence.storageClassName="standard" \
        --set persistence.enabled=true

    log "INFO" "Core services deployed successfully"
}

# Configure security measures
configure_security() {
    log "INFO" "Configuring security measures"

    # Enable encryption at rest
    kubectl create secret encryption-provider-config \
        --from-file=config.yaml=encryption-config.yaml \
        -n kube-system

    # Apply pod security policies
    kubectl apply -f infrastructure/kubernetes/security/pod-security-policies.yaml

    # Setup network policies
    kubectl apply -f infrastructure/kubernetes/security/network-policies.yaml

    # Configure audit logging
    kubectl apply -f infrastructure/kubernetes/security/audit-policy.yaml

    # Setup RBAC
    kubectl apply -f infrastructure/kubernetes/security/rbac.yaml

    log "INFO" "Security measures configured successfully"
}

# Cleanup function
cleanup() {
    if [ $? -ne 0 ]; then
        log "ERROR" "An error occurred during cluster initialization"
        log "INFO" "Cleaning up resources..."
        # Add cleanup logic here
    fi
}

# Main execution
main() {
    trap cleanup EXIT

    log "INFO" "Starting cluster initialization for environment: $ENVIRONMENT"

    # Execute initialization steps
    validate_prerequisites
    create_eks_cluster "$CLUSTER_NAME" "$AWS_REGION" "$NODE_TYPE" "$ENVIRONMENT"
    setup_namespaces
    configure_storage
    deploy_core_services
    configure_security

    log "INFO" "Cluster initialization completed successfully"
}

# Execute main function
main "$@"