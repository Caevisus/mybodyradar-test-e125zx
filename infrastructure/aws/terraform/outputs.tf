# Network Infrastructure Outputs
output "network_outputs" {
  description = "Comprehensive network configuration details with enhanced security validation"
  value = {
    vpc_id          = vpc.vpc_id
    vpc_cidr        = vpc.vpc_cidr_block
    private_subnets = vpc.private_subnet_ids
    public_subnets  = vpc.public_subnet_ids
    route_tables    = vpc.route_table_ids
    nat_ips         = vpc.nat_gateway_ips
  }
  sensitive = true
}

# EKS Cluster Outputs
output "compute_outputs" {
  description = "EKS cluster details with enhanced security measures"
  value = {
    cluster_endpoint    = eks.cluster_endpoint
    cluster_name        = eks.cluster_name
    cluster_ca_data     = eks.cluster_certificate_authority_data
    security_group_id   = eks.cluster_security_group_id
    node_groups        = eks.node_group_arns
  }
  sensitive = true
}

# Database Outputs
output "database_outputs" {
  description = "Database connection details with monitoring information"
  value = {
    primary_endpoint     = rds.rds_endpoint
    replica_endpoint     = rds.rds_replica_endpoint
    monitoring_endpoint  = rds.monitoring_endpoint
    backup_retention     = rds.backup_retention_period
  }
  sensitive = true
}

# Security Outputs
output "security_outputs" {
  description = "Security-related configuration and access details"
  value = {
    vpc_flow_logs_group = "/aws/vpc/${var.project_name}-${var.environment}-flow-logs"
    eks_logs_group      = "/aws/eks/${var.project_name}-${var.environment}/cluster"
    rds_logs_group      = "/aws/rds/${var.project_name}-${var.environment}"
  }
  sensitive = true
}

# Monitoring Outputs
output "monitoring_outputs" {
  description = "Monitoring and observability endpoints"
  value = {
    cloudwatch_dashboard = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${var.project_name}-${var.environment}"
    prometheus_endpoint  = "${eks.cluster_endpoint}/api/v1/namespaces/monitoring/services/prometheus:9090/proxy"
    grafana_endpoint    = "${eks.cluster_endpoint}/api/v1/namespaces/monitoring/services/grafana/proxy"
  }
  sensitive = true
}

# Backup and Recovery Outputs
output "backup_outputs" {
  description = "Backup and disaster recovery configuration details"
  value = {
    rds_backup_window = rds.backup_window
    rds_maintenance_window = "Mon:04:00-Mon:05:00"
    snapshot_retention_days = rds.backup_retention_period
    cross_region_backup_enabled = true
  }
  sensitive = true
}

# IAM Role Outputs
output "iam_outputs" {
  description = "IAM roles and policies for service access"
  value = {
    eks_cluster_role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.project_name}-eks-cluster-${var.environment}"
    eks_node_role_arn    = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.project_name}-eks-node-${var.environment}"
    rds_monitoring_role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.project_name}-rds-monitoring-${var.environment}"
  }
  sensitive = true
}

# Service Discovery Outputs
output "service_discovery_outputs" {
  description = "Service discovery and DNS configuration"
  value = {
    eks_api_endpoint = eks.cluster_endpoint
    rds_writer_endpoint = rds.rds_endpoint
    rds_reader_endpoint = rds.rds_replica_endpoint
    vpc_endpoints = {
      s3        = "com.amazonaws.${var.aws_region}.s3"
      dynamodb  = "com.amazonaws.${var.aws_region}.dynamodb"
      ecr_api   = "com.amazonaws.${var.aws_region}.ecr.api"
      ecr_dkr   = "com.amazonaws.${var.aws_region}.ecr.dkr"
    }
  }
  sensitive = true
}

# Cost Management Outputs
output "cost_outputs" {
  description = "Cost allocation and tracking configuration"
  value = {
    cost_center = "wearables-division"
    environment = var.environment
    project     = var.project_name
    managed_by  = "terraform"
  }
  sensitive = false
}