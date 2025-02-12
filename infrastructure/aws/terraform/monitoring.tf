# Provider configuration for AWS and Helm
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }
}

# Local variables for common configurations
locals {
  monitoring_tags = merge(
    {
      Component     = "monitoring"
      Environment   = var.environment
      ManagedBy     = "terraform"
      Compliance    = "hipaa"
      BackupRequired = "true"
    },
    var.tags
  )

  prometheus_storage_class = "gp3"
  grafana_storage_size    = "50Gi"
  retention_period        = "15d"
}

# Monitoring namespace with HIPAA compliance labels
resource "kubernetes_namespace" "monitoring" {
  metadata {
    name = "monitoring"
    labels = {
      name         = "monitoring"
      environment  = var.environment
      compliance   = "hipaa"
      backup       = "required"
    }
  }
}

# KMS key for log encryption
resource "aws_kms_key" "monitoring" {
  description             = "KMS key for monitoring data encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  tags                   = local.monitoring_tags
}

# CloudWatch Log Groups for different components
resource "aws_cloudwatch_log_group" "application" {
  name              = "/smart-apparel/${var.environment}/application"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.monitoring.arn
  tags              = local.monitoring_tags
}

resource "aws_cloudwatch_log_group" "system_metrics" {
  name              = "/smart-apparel/${var.environment}/system-metrics"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.monitoring.arn
  tags              = local.monitoring_tags
}

# Prometheus Stack deployment via Helm
resource "helm_release" "prometheus_stack" {
  name       = "prometheus"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name
  version    = "45.7.1"

  values = [
    yamlencode({
      prometheus = {
        prometheusSpec = {
          retention        = local.retention_period
          replicaCount    = 3
          storageSpec = {
            volumeClaimTemplate = {
              spec = {
                storageClassName = local.prometheus_storage_class
                resources = {
                  requests = {
                    storage = "100Gi"
                  }
                }
              }
            }
          }
        }
      }
      alertmanager = {
        enabled      = true
        replicaCount = 3
      }
      grafana = {
        enabled = true
        persistence = {
          enabled = true
          size    = local.grafana_storage_size
        }
        sidecar = {
          dashboards = {
            enabled = true
            label   = "grafana_dashboard"
          }
        }
        multicluster = {
          enabled = true
        }
      }
    })
  ]
}

# CloudWatch Dashboard for system-wide monitoring
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "smart-apparel-${var.environment}"
  
  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["SmartApparel", "SystemUptime", "Environment", var.environment]
          ]
          period = 300
          stat   = "Average"
          title  = "System Uptime"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["SmartApparel", "APILatency", "Environment", var.environment]
          ]
          period = 60
          stat   = "Average"
          title  = "API Latency"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["SmartApparel", "ErrorRate", "Environment", var.environment]
          ]
          period = 300
          stat   = "Sum"
          title  = "Error Rates"
        }
      }
    ]
  })
}

# CloudWatch Alarms for critical metrics
resource "aws_cloudwatch_metric_alarm" "system_health" {
  alarm_name          = "system-health-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "SystemHealth"
  namespace           = "SmartApparel"
  period             = "300"
  statistic          = "Average"
  threshold          = "1"
  alarm_description  = "System health check failed"
  alarm_actions      = [aws_sns_topic.monitoring_alerts.arn]
  tags               = local.monitoring_tags
}

# SNS Topic for monitoring alerts
resource "aws_sns_topic" "monitoring_alerts" {
  name              = "monitoring-alerts-${var.environment}"
  kms_master_key_id = aws_kms_key.monitoring.id
  tags              = local.monitoring_tags
}

# Outputs for monitoring endpoints
output "prometheus_url" {
  description = "URL for Prometheus web interface"
  value       = "https://prometheus.${var.environment}.smart-apparel.internal"
}

output "grafana_url" {
  description = "URL for Grafana dashboards"
  value       = "https://grafana.${var.environment}.smart-apparel.internal"
}

output "alertmanager_url" {
  description = "URL for AlertManager interface"
  value       = "https://alertmanager.${var.environment}.smart-apparel.internal"
}