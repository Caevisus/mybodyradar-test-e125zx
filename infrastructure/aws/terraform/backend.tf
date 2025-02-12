# Backend configuration for smart-apparel system Terraform state management
# Version: Terraform ~> 1.5
# Purpose: Provides secure, scalable state storage with cross-region replication support

terraform {
  backend "s3" {
    # Primary state storage configuration
    bucket         = "smart-apparel-terraform-state"
    key            = "terraform.tfstate"
    region         = "${var.aws_region}"
    encrypt        = true
    dynamodb_table = "smart-apparel-terraform-locks"
    acl            = "private"

    # Enhanced security configuration
    kms_key_id     = "arn:aws:kms:${var.aws_region}:ACCOUNT_ID:key/KEY_ID"
    
    # Workspace and environment management
    workspace_key_prefix = "env"
    profile             = "terraform"

    # Validation and security checks
    skip_region_validation      = false
    skip_credentials_validation = false
    skip_metadata_api_check     = false
    force_path_style           = false

    # Additional enterprise features
    versioning = true

    # Lifecycle rules are managed through bucket configuration
    lifecycle {
      prevent_destroy = true
    }
  }

  # Required provider configuration
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }

  # Terraform version constraint
  required_version = "~> 1.5"
}

# Backend configuration validation
terraform {
  experiments = [module_variable_optional_attrs]
}

# State locking configuration is managed through DynamoDB
# The table is expected to have a primary key named "LockID"
# TTL is configured for automatic lock expiration after 24 hours