#!/bin/bash

# Database Backup Script for Smart Apparel Platform
# Version: 1.0.0
# Dependencies:
# - mongodb-database-tools v100.7.0
# - influxdb2-cli v2.7.0
# - aws-cli v2.13.0

set -euo pipefail

# Global configuration
BACKUP_ROOT="/var/backups/smartapparel"
MONGODB_BACKUP_DIR="${BACKUP_ROOT}/mongodb"
INFLUXDB_BACKUP_DIR="${BACKUP_ROOT}/influxdb"
S3_BUCKET="s3://smartapparel-backups"
RETENTION_DAYS=30
MAX_PARALLEL_UPLOADS=5
COMPRESSION_RATIO_THRESHOLD=0.4
ALERT_ENDPOINT="https://api.smartapparel.com/alerts"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Load database configurations
source "$(dirname "$0")/../../src/backend/src/config/database.config.ts"

# Check all required dependencies and configurations
check_dependencies() {
    local exit_code=0

    # Check required tools
    for cmd in mongodump influxd aws gzip parallel; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            echo "Error: Required command '$cmd' not found"
            exit_code=1
        fi
    done

    # Verify versions
    if ! mongodump --version | grep -q "100.7"; then
        echo "Error: mongodump version 100.7.0 required"
        exit_code=1
    fi

    if ! influxd version | grep -q "2.7"; then
        echo "Error: influxd version 2.7.0 required"
        exit_code=1
    fi

    # Check backup directories
    for dir in "$BACKUP_ROOT" "$MONGODB_BACKUP_DIR" "$INFLUXDB_BACKUP_DIR"; do
        if ! mkdir -p "$dir"; then
            echo "Error: Cannot create directory $dir"
            exit_code=1
        fi
    done

    # Check S3 bucket access
    if ! aws s3 ls "$S3_BUCKET" >/dev/null 2>&1; then
        echo "Error: Cannot access S3 bucket $S3_BUCKET"
        exit_code=1
    fi

    # Check available disk space
    local available_space=$(df -BG "$BACKUP_ROOT" | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$available_space" -lt 50 ]; then
        echo "Error: Insufficient disk space (< 50GB available)"
        exit_code=1
    fi

    return $exit_code
}

# MongoDB backup function
backup_mongodb() {
    local backup_path="$1"
    local exit_code=0
    local start_time=$(date +%s)

    echo "Starting MongoDB backup at $(date)"

    # Create backup directory
    mkdir -p "$backup_path"

    # Execute MongoDB backup with compression
    if ! mongodump \
        --uri="$MONGODB_URI" \
        --out="$backup_path" \
        --gzip \
        --oplog \
        --numParallelCollections=4; then
        handle_error "MongoDB backup failed" 1
        return 1
    fi

    # Verify backup integrity
    if ! mongorestore --dry-run --gzip --dir="$backup_path" >/dev/null 2>&1; then
        handle_error "MongoDB backup verification failed" 1
        return 1
    fi

    # Calculate compression ratio
    local original_size=$(du -sb "$backup_path" | awk '{print $1}')
    local compressed_size=$(find "$backup_path" -type f -name "*.gz" -exec du -sb {} + | awk '{total += $1} END {print total}')
    local compression_ratio=$(echo "scale=2; $compressed_size/$original_size" | bc)

    if (( $(echo "$compression_ratio > $COMPRESSION_RATIO_THRESHOLD" | bc -l) )); then
        handle_error "MongoDB compression ratio above threshold" 1
        return 1
    fi

    # Upload to S3 with parallel processing
    find "$backup_path" -type f -print0 | \
        parallel -0 -j "$MAX_PARALLEL_UPLOADS" \
        aws s3 cp {} "$S3_BUCKET/mongodb/${TIMESTAMP}/" \
        --storage-class STANDARD_IA \
        --metadata "timestamp=${TIMESTAMP}"

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo "MongoDB backup completed in $duration seconds"
    return $exit_code
}

# InfluxDB backup function
backup_influxdb() {
    local backup_path="$1"
    local exit_code=0
    local start_time=$(date +%s)

    echo "Starting InfluxDB backup at $(date)"

    # Create backup directory
    mkdir -p "$backup_path"

    # Execute InfluxDB backup
    if ! influxd backup \
        --org "$INFLUXDB_ORG" \
        --token "$INFLUXDB_TOKEN" \
        --bucket "$INFLUXDB_BUCKET" \
        --path "$backup_path"; then
        handle_error "InfluxDB backup failed" 1
        return 1
    fi

    # Compress backup
    if ! tar czf "${backup_path}.tar.gz" -C "$(dirname "$backup_path")" "$(basename "$backup_path")"; then
        handle_error "InfluxDB backup compression failed" 1
        return 1
    fi

    # Upload to S3
    if ! aws s3 cp "${backup_path}.tar.gz" \
        "$S3_BUCKET/influxdb/${TIMESTAMP}/backup.tar.gz" \
        --storage-class STANDARD_IA \
        --metadata "timestamp=${TIMESTAMP}"; then
        handle_error "InfluxDB S3 upload failed" 1
        return 1
    fi

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo "InfluxDB backup completed in $duration seconds"
    return $exit_code
}

# Cleanup old backups
cleanup_old_backups() {
    local backup_dir="$1"
    local days="$2"
    local exit_code=0

    echo "Cleaning up backups older than $days days"

    # Remove local backups
    find "$backup_dir" -type f -mtime +"$days" -delete

    # Remove S3 backups
    aws s3 rm "$S3_BUCKET" \
        --recursive \
        --exclude "*" \
        --include "*/$(date -d "-${days} days" +%Y%m%d)*" \
        --quiet

    return $exit_code
}

# Error handling function
handle_error() {
    local message="$1"
    local code="$2"
    
    echo "Error: $message" >&2
    
    # Send alert
    curl -X POST "$ALERT_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d "{
            \"type\": \"backup_error\",
            \"message\": \"$message\",
            \"code\": $code,
            \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"
        }" || true

    return 1
}

# Main execution
main() {
    local exit_code=0

    # Check dependencies
    if ! check_dependencies; then
        handle_error "Dependency check failed" 1
        exit 1
    fi

    # MongoDB backup
    if ! backup_mongodb "${MONGODB_BACKUP_DIR}/${TIMESTAMP}"; then
        exit_code=1
    fi

    # InfluxDB backup
    if ! backup_influxdb "${INFLUXDB_BACKUP_DIR}/${TIMESTAMP}"; then
        exit_code=1
    fi

    # Cleanup old backups
    if ! cleanup_old_backups "$BACKUP_ROOT" "$RETENTION_DAYS"; then
        exit_code=1
    fi

    exit $exit_code
}

# Execute main function
main