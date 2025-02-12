# Project and Environment Variables
variable "project_name" {
  type        = string
  description = "Name of the smart-apparel project used for resource naming and tagging"
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "environment" {
  type        = string
  description = "Deployment environment (development, staging, production)"
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

# Region Configuration
variable "aws_region" {
  type        = string
  description = "Primary AWS region for resource deployment"
}

variable "secondary_regions" {
  type        = list(string)
  description = "Secondary AWS regions for multi-region deployment and disaster recovery"
}

# Network Configuration
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for VPC"
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}

variable "availability_zones" {
  type        = list(string)
  description = "List of availability zones for high availability deployment"
}

# EKS Configuration
variable "eks_cluster_version" {
  type        = string
  description = "Kubernetes version for EKS cluster"
  validation {
    condition     = can(regex("^1\\.(2[1-9]|[3-9][0-9])\\.\\d+$", var.eks_cluster_version))
    error_message = "EKS cluster version must be 1.21 or higher."
  }
}

variable "eks_node_groups" {
  type = map(object({
    instance_types = list(string)
    min_size       = number
    max_size       = number
    desired_size   = number
    disk_size      = number
    labels         = map(string)
    taints         = list(object({
      key    = string
      value  = string
      effect = string
    }))
  }))
  description = "Configuration for EKS node groups including instance types and scaling"
}

# RDS Configuration
variable "rds_configuration" {
  type = map(object({
    instance_class    = string
    engine           = string
    engine_version   = string
    allocated_storage = number
    storage_type      = string
    multi_az         = bool
    backup_retention = number
    backup_window    = string
  }))
  description = "RDS configuration including instance type, storage, and engine version"
}

# ElastiCache Configuration
variable "elasticache_configuration" {
  type = map(object({
    node_type       = string
    num_cache_nodes = number
    engine_version  = string
    port           = number
    parameter_group_family = string
    automatic_failover_enabled = bool
  }))
  description = "ElastiCache configuration for Redis clusters"
}

# API Gateway Configuration
variable "api_gateway_configuration" {
  type = map(object({
    endpoint_type = string
    stage_name    = string
    throttling_rate_limit  = number
    throttling_burst_limit = number
    metrics_enabled = bool
    logging_level  = string
  }))
  description = "API Gateway configuration including stages and throttling"
}

# Security Configuration
variable "security_configuration" {
  type = map(object({
    enable_waf = bool
    enable_shield = bool
    enable_guard_duty = bool
    kms_key_deletion_window = number
    ssl_policy = string
    allowed_ip_ranges = list(string)
  }))
  description = "Security settings including WAF, KMS, and network policies"
}

# Monitoring Configuration
variable "monitoring_configuration" {
  type = map(object({
    enable_enhanced_monitoring = bool
    monitoring_interval = number
    alarm_cpu_threshold = number
    alarm_memory_threshold = number
    retention_in_days = number
    enable_dashboard = bool
  }))
  description = "Monitoring and alerting configuration"
}

# Backup Configuration
variable "backup_configuration" {
  type = map(object({
    enable_backup = bool
    retention_period = number
    backup_window = string
    enable_cross_region = bool
    lifecycle_rules = list(object({
      enabled = bool
      prefix  = string
      transitions = list(object({
        days          = number
        storage_class = string
      }))
    }))
  }))
  description = "Backup and disaster recovery configuration"
}

# Tags Configuration
variable "tags" {
  type = map(string)
  description = "Common tags to be applied to all resources"
  default = {}
}