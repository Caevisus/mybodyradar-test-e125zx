# Provider configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }
}

# KMS key for EKS encryption
resource "aws_kms_key" "eks" {
  description             = "KMS key for EKS cluster encryption"
  deletion_window_in_days = 7
  enable_key_rotation    = true
  
  tags = {
    Environment = var.environment
    Project     = "smart-apparel"
    ManagedBy   = "terraform"
  }
}

# EKS Cluster
resource "aws_eks_cluster" "main" {
  name     = "smart-apparel-${var.environment}"
  role_arn = data.aws_iam_role.eks_cluster_role.arn
  version  = var.eks_cluster_version

  vpc_config {
    subnet_ids              = data.aws_subnet_ids.private.ids
    endpoint_private_access = true
    endpoint_public_access  = true
    public_access_cidrs    = ["${var.vpc_cidr}"]
    security_group_ids     = [aws_security_group.eks_cluster.id]
  }

  encryption_config {
    provider {
      key_arn = aws_kms_key.eks.arn
    }
    resources = ["secrets"]
  }

  enabled_cluster_log_types = [
    "api",
    "audit",
    "authenticator",
    "controllerManager",
    "scheduler"
  ]

  kubernetes_network_config {
    service_ipv4_cidr = "172.20.0.0/16"
    ip_family         = "ipv4"
  }

  tags = {
    Environment         = var.environment
    Project            = "smart-apparel"
    ManagedBy          = "terraform"
    SecurityCompliance = "hipaa"
    CostCenter         = "wearables-division"
  }

  depends_on = [
    aws_kms_key.eks
  ]
}

# EKS Node Group
resource "aws_eks_node_group" "main" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "smart-apparel-workers-${var.environment}"
  node_role_arn   = data.aws_iam_role.eks_node_role.arn
  subnet_ids      = data.aws_subnet_ids.private.ids
  
  instance_types = var.eks_node_instance_types
  capacity_type  = "ON_DEMAND"
  disk_size      = 100

  scaling_config {
    desired_size = var.eks_node_min_size
    min_size     = var.eks_node_min_size
    max_size     = var.eks_node_max_size
  }

  update_config {
    max_unavailable_percentage = 25
  }

  labels = {
    role        = "application"
    environment = var.environment
    project     = "smart-apparel"
  }

  taint {
    key    = "dedicated"
    value  = "smart-apparel"
    effect = "NO_SCHEDULE"
  }

  tags = {
    Environment  = var.environment
    Project      = "smart-apparel"
    ManagedBy    = "terraform"
    AutoScaling  = "enabled"
    PatchGroup   = "eks-nodes"
  }
}

# Security Group for EKS Cluster
resource "aws_security_group" "eks_cluster" {
  name        = "smart-apparel-eks-${var.environment}"
  description = "Security group for EKS cluster"
  vpc_id      = data.aws_vpc.main.id

  ingress {
    description = "Cluster API access"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.main.cidr_block]
  }

  ingress {
    description = "Node communication"
    from_port   = 1025
    to_port     = 65535
    protocol    = "tcp"
    self        = true
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "smart-apparel-eks-sg-${var.environment}"
    Environment = var.environment
    Project     = "smart-apparel"
    ManagedBy   = "terraform"
  }
}

# CloudWatch Log Group for EKS Cluster Logs
resource "aws_cloudwatch_log_group" "eks" {
  name              = "/aws/eks/smart-apparel-${var.environment}/cluster"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Project     = "smart-apparel"
    ManagedBy   = "terraform"
  }
}

# Outputs
output "cluster_endpoint" {
  description = "EKS cluster endpoint URL"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_name" {
  description = "EKS cluster name"
  value       = aws_eks_cluster.main.name
}

output "cluster_security_group_id" {
  description = "Security group ID for the cluster"
  value       = aws_security_group.eks_cluster.id
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data for cluster authentication"
  value       = aws_eks_cluster.main.certificate_authority[0].data
}