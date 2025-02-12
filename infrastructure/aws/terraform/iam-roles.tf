# Provider and data source configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Get current AWS account ID
data "aws_caller_identity" "current" {}

# EKS Cluster Role
resource "aws_iam_role" "eks_cluster_role" {
  name = "smart-apparel-eks-cluster-${var.environment}"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "eks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
      Condition = {
        StringEquals = {
          "aws:SourceAccount" = data.aws_caller_identity.current.account_id
        }
      }
    }]
  })

  managed_policy_arns = [
    "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy",
    "arn:aws:iam::aws:policy/AmazonEKSVPCResourceController",
    "arn:aws:iam::aws:policy/AmazonEKSServicePolicy"
  ]

  max_session_duration = 3600

  tags = {
    Environment     = var.environment
    Project         = "smart-apparel"
    ManagedBy      = "terraform"
    SecurityLevel  = "high"
    ComplianceScope = "hipaa"
  }
}

# EKS Node Role
resource "aws_iam_role" "eks_node_role" {
  name = "smart-apparel-eks-node-${var.environment}"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
      Action = "sts:AssumeRole"
      Condition = {
        StringEquals = {
          "aws:SourceAccount" = data.aws_caller_identity.current.account_id
        }
      }
    }]
  })

  managed_policy_arns = [
    "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
    "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
    "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
    "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
    "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
  ]

  max_session_duration = 3600

  tags = {
    Environment     = var.environment
    Project         = "smart-apparel"
    ManagedBy      = "terraform"
    SecurityLevel  = "high"
    ComplianceScope = "hipaa"
  }
}

# RDS Monitoring Role
resource "aws_iam_role" "rds_monitoring_role" {
  name = "smart-apparel-rds-monitoring-${var.environment}"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "monitoring.rds.amazonaws.com"
      }
      Action = "sts:AssumeRole"
      Condition = {
        StringEquals = {
          "aws:SourceAccount" = data.aws_caller_identity.current.account_id
        }
      }
    }]
  })

  managed_policy_arns = [
    "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
  ]

  max_session_duration = 3600

  tags = {
    Environment     = var.environment
    Project         = "smart-apparel"
    ManagedBy      = "terraform"
    SecurityLevel  = "high"
    ComplianceScope = "hipaa"
  }
}

# S3 Access Policy
resource "aws_iam_policy" "s3_access_policy" {
  name = "smart-apparel-s3-access-${var.environment}"
  path = "/"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket"
      ]
      Resource = [
        "arn:aws:s3:::smart-apparel-${var.environment}/*"
      ]
      Condition = {
        StringEquals = {
          "s3:x-amz-server-side-encryption" = "aws:kms"
        }
      }
    }]
  })

  tags = {
    Environment     = var.environment
    Project         = "smart-apparel"
    ManagedBy      = "terraform"
    SecurityLevel  = "high"
    ComplianceScope = "hipaa"
  }
}

# CloudWatch Policy
resource "aws_iam_policy" "cloudwatch_policy" {
  name = "smart-apparel-cloudwatch-${var.environment}"
  path = "/"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "cloudwatch:PutMetricData",
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Resource = "*"
      Condition = {
        StringEquals = {
          "aws:RequestedRegion" = var.aws_region
        }
      }
    }]
  })

  tags = {
    Environment     = var.environment
    Project         = "smart-apparel"
    ManagedBy      = "terraform"
    SecurityLevel  = "high"
    ComplianceScope = "hipaa"
  }
}

# Output definitions
output "eks_cluster_role_arn" {
  description = "ARN of EKS cluster IAM role"
  value       = aws_iam_role.eks_cluster_role.arn
}

output "eks_node_role_arn" {
  description = "ARN of EKS node IAM role"
  value       = aws_iam_role.eks_node_role.arn
}

output "rds_monitoring_role_arn" {
  description = "ARN of RDS monitoring IAM role"
  value       = aws_iam_role.rds_monitoring_role.arn
}