# Configure Terraform version and required providers
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }
}

# AWS Provider Configuration
provider "aws" {
  region = var.aws_region

  # Default tags applied to all resources
  default_tags {
    tags = {
      Environment        = var.environment
      Project           = "smart-apparel"
      ManagedBy         = "terraform"
      Team              = "infrastructure"
      SecurityLevel     = "high"
      DataClassification = "sensitive"
      BackupPolicy      = "required"
    }
  }

  # Enhanced AWS provider features
  assume_role {
    role_arn     = var.terraform_role_arn
    session_name = "terraform-session"
  }

  # Custom endpoint configuration for specific services
  endpoints {
    s3        = "https://s3.${var.aws_region}.amazonaws.com"
    dynamodb  = "https://dynamodb.${var.aws_region}.amazonaws.com"
  }

  # Provider-level retry configuration
  retry_mode = "standard"
  max_retries = 3
}

# Kubernetes Provider Configuration for EKS
provider "kubernetes" {
  host                   = data.aws_eks_cluster.cluster.endpoint
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)
  token                  = data.aws_eks_cluster_auth.cluster.token

  # EKS authentication configuration
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args = [
      "eks",
      "get-token",
      "--cluster-name",
      var.cluster_name
    ]
  }

  # Provider timeouts and retry settings
  client_connect_timeout = "30s"
  client_read_timeout   = "30s"
}

# Helm Provider Configuration
provider "helm" {
  kubernetes {
    host                   = data.aws_eks_cluster.cluster.endpoint
    cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)
    token                  = data.aws_eks_cluster_auth.cluster.token

    # EKS authentication configuration
    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args = [
        "eks",
        "get-token",
        "--cluster-name",
        var.cluster_name
      ]
    }
  }

  # Helm-specific configuration
  repository_cache       = "/tmp/helm/cache"
  repository_config     = "/tmp/helm/repositories"
  debug                 = true
  verify                = true

  # Registry configuration for OCI support
  registry {
    timeout = 30
    tls_verify = true
  }
}