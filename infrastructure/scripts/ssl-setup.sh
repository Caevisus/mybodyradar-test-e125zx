#!/bin/bash

# SSL/TLS Certificate Setup and Management Script
# Version: 1.0.0
# Implements enterprise-grade SSL/TLS configuration for the smart-apparel system
# Requires: openssl 1.1.1+, kubectl 1.27+, cert-manager 1.12+

set -euo pipefail

# Global Configuration
CERT_PATH="/etc/ssl/certs"
KEY_PATH="/etc/ssl/private"
CERT_VALIDITY_DAYS=365
KEY_SIZE=4096
TLS_MIN_VERSION="1.3"
ALLOWED_CIPHER_SUITES="TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256"
CERT_BACKUP_PATH="/backup/ssl"
HEALTH_CHECK_INTERVAL=300

# Logging configuration
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
    exit 1
}

# Validate required tools and permissions
validate_prerequisites() {
    log "Validating prerequisites..."
    
    # Check for required tools
    command -v openssl >/dev/null 2>&1 || error "openssl is required but not installed"
    command -v kubectl >/dev/null 2>&1 || error "kubectl is required but not installed"
    
    # Check directory permissions
    [[ -w "$CERT_PATH" ]] || error "Cannot write to $CERT_PATH"
    [[ -w "$KEY_PATH" ]] || error "Cannot write to $KEY_PATH"
    
    # Create backup directory if it doesn't exist
    mkdir -p "$CERT_BACKUP_PATH"
}

# Generate self-signed certificate with enhanced security parameters
generate_self_signed_cert() {
    local domain=$1
    local output_dir=$2
    local sans=$3
    
    log "Generating self-signed certificate for $domain"
    
    # Generate strong private key
    openssl genrsa -out "${output_dir}/private.key" $KEY_SIZE || error "Failed to generate private key"
    
    # Create CSR configuration
    cat > "${output_dir}/csr.conf" <<EOF
[req]
default_bits = $KEY_SIZE
prompt = no
default_md = sha384
req_extensions = req_ext
distinguished_name = dn

[dn]
CN = $domain
O = Smart Apparel Inc.
OU = Security Operations
C = US
ST = Production
L = Production

[req_ext]
subjectAltName = @alt_names

[alt_names]
$sans
EOF
    
    # Generate CSR
    openssl req -new -key "${output_dir}/private.key" \
        -out "${output_dir}/server.csr" \
        -config "${output_dir}/csr.conf" || error "Failed to generate CSR"
    
    # Generate certificate
    openssl x509 -req -in "${output_dir}/server.csr" \
        -signkey "${output_dir}/private.key" \
        -out "${output_dir}/server.crt" \
        -days $CERT_VALIDITY_DAYS \
        -sha384 \
        -extensions req_ext \
        -extfile "${output_dir}/csr.conf" || error "Failed to generate certificate"
    
    # Set secure permissions
    chmod 600 "${output_dir}/private.key"
    chmod 644 "${output_dir}/server.crt"
    
    # Backup certificates
    cp "${output_dir}/server.crt" "${CERT_BACKUP_PATH}/${domain}.crt"
    cp "${output_dir}/private.key" "${CERT_BACKUP_PATH}/${domain}.key"
    
    log "Certificate generation completed for $domain"
}

# Setup cert-manager for automated certificate management
setup_cert_manager() {
    local cluster_name=$1
    local namespace=$2
    
    log "Setting up cert-manager in cluster $cluster_name"
    
    # Add cert-manager helm repo
    helm repo add jetstack https://charts.jetstack.io
    helm repo update
    
    # Install cert-manager with custom values
    helm upgrade --install cert-manager jetstack/cert-manager \
        --namespace "$namespace" \
        --create-namespace \
        --version v1.12.0 \
        --set installCRDs=true \
        --set global.leaderElection.namespace="$namespace" \
        --set prometheus.enabled=true \
        --set webhook.timeoutSeconds=30 || error "Failed to install cert-manager"
    
    # Create ClusterIssuer for Let's Encrypt
    cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: security@smart-apparel.com
    privateKeySecretRef:
      name: letsencrypt-prod-key
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
    
    log "cert-manager setup completed"
}

# Configure TLS settings for API Gateway
configure_tls_gateway() {
    local cert_path=$1
    local key_path=$2
    
    log "Configuring TLS for API Gateway"
    
    # Create TLS secret for API Gateway
    kubectl create secret tls api-gateway-tls \
        --cert="$cert_path" \
        --key="$key_path" \
        --namespace=backend \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Configure API Gateway TLS settings
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: gateway-tls-config
  namespace: backend
data:
  tls.conf: |
    ssl_protocols TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers $ALLOWED_CIPHER_SUITES;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    ssl_stapling on;
    ssl_stapling_verify on;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
EOF
    
    log "API Gateway TLS configuration completed"
}

# Monitor certificate health and expiration
monitor_certificates() {
    while true; do
        log "Checking certificate health..."
        
        # Check all certificates in cert-manager
        kubectl get certificates -A -o json | jq -r '.items[] | select(.status.conditions[] | select(.type=="Ready" and .status!="True")) | .metadata.name' | while read -r cert; do
            log "WARNING: Certificate $cert is not ready"
        done
        
        # Check certificate expiration
        find "$CERT_PATH" -name "*.crt" -type f | while read -r cert; do
            expiry=$(openssl x509 -enddate -noout -in "$cert" | cut -d= -f2)
            expiry_epoch=$(date -d "$expiry" +%s)
            current_epoch=$(date +%s)
            days_left=$(( (expiry_epoch - current_epoch) / 86400 ))
            
            if [ "$days_left" -lt 30 ]; then
                log "WARNING: Certificate $cert expires in $days_left days"
            fi
        done
        
        sleep "$HEALTH_CHECK_INTERVAL"
    done
}

# Main execution
main() {
    validate_prerequisites
    
    # Generate self-signed certificates for development
    generate_self_signed_cert "api.smart-apparel.local" "$CERT_PATH" "DNS.1 = api.smart-apparel.local\nDNS.2 = *.smart-apparel.local"
    
    # Setup cert-manager in production
    setup_cert_manager "smart-apparel-prod" "cert-manager"
    
    # Configure API Gateway TLS
    configure_tls_gateway "$CERT_PATH/server.crt" "$KEY_PATH/private.key"
    
    # Start certificate monitoring in background
    monitor_certificates &
    
    log "SSL/TLS setup completed successfully"
}

main "$@"