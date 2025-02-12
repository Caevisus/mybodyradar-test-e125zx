# Provider configuration with version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# KMS key for S3 bucket encryption
resource "aws_kms_key" "s3_key" {
  description             = "KMS key for S3 bucket encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

# Sensor data bucket for hot storage (7 days)
resource "aws_s3_bucket" "sensor_data_bucket" {
  bucket = "${var.environment}-${var.project_name}-sensor-data"

  tags = {
    Environment = var.environment
    Project     = var.project_name
    DataType    = "sensor-data"
    ManagedBy   = "terraform"
  }
}

resource "aws_s3_bucket_versioning" "sensor_data_versioning" {
  bucket = aws_s3_bucket.sensor_data_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_rule" "sensor_data_lifecycle" {
  bucket = aws_s3_bucket.sensor_data_bucket.id
  id     = "transition-to-ia"
  status = "Enabled"

  transition {
    days          = 7
    storage_class = "STANDARD_IA"
  }
}

# Analytics bucket with 5-year retention
resource "aws_s3_bucket" "analytics_bucket" {
  bucket = "${var.environment}-${var.project_name}-analytics"

  tags = {
    Environment = var.environment
    Project     = var.project_name
    DataType    = "analytics"
    ManagedBy   = "terraform"
  }
}

resource "aws_s3_bucket_versioning" "analytics_versioning" {
  bucket = aws_s3_bucket.analytics_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_rule" "analytics_lifecycle" {
  bucket = aws_s3_bucket.analytics_bucket.id
  id     = "glacier-transition"
  status = "Enabled"

  transition {
    days          = 90
    storage_class = "GLACIER"
  }

  expiration {
    days = 1825  # 5 years
  }
}

# Backup bucket with Glacier transition
resource "aws_s3_bucket" "backup_bucket" {
  bucket = "${var.environment}-${var.project_name}-backups"

  tags = {
    Environment = var.environment
    Project     = var.project_name
    DataType    = "backups"
    ManagedBy   = "terraform"
  }
}

resource "aws_s3_bucket_versioning" "backup_versioning" {
  bucket = aws_s3_bucket.backup_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_rule" "backup_lifecycle" {
  bucket = aws_s3_bucket.backup_bucket.id
  id     = "glacier-transition"
  status = "Enabled"

  transition {
    days          = 30
    storage_class = "GLACIER"
  }
}

# Static assets bucket with CloudFront configuration
resource "aws_s3_bucket" "assets_bucket" {
  bucket = "${var.environment}-${var.project_name}-assets"

  tags = {
    Environment = var.environment
    Project     = var.project_name
    DataType    = "assets"
    ManagedBy   = "terraform"
  }
}

resource "aws_s3_bucket_versioning" "assets_versioning" {
  bucket = aws_s3_bucket.assets_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_website_configuration" "assets_website" {
  bucket = aws_s3_bucket.assets_bucket.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "error.html"
  }
}

resource "aws_s3_bucket_cors_rule" "assets_cors" {
  bucket = aws_s3_bucket.assets_bucket.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    max_age_seconds = 3000
  }
}

# Common encryption configuration for all buckets
resource "aws_s3_bucket_server_side_encryption_configuration" "bucket_encryption" {
  for_each = toset([
    aws_s3_bucket.sensor_data_bucket.id,
    aws_s3_bucket.analytics_bucket.id,
    aws_s3_bucket.backup_bucket.id,
    aws_s3_bucket.assets_bucket.id
  ])

  bucket = each.value

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.s3_key.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

# Bucket policies
resource "aws_s3_bucket_policy" "sensor_data_bucket_policy" {
  bucket = aws_s3_bucket.sensor_data_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnforceSSLOnly"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.sensor_data_bucket.arn,
          "${aws_s3_bucket.sensor_data_bucket.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# Outputs
output "sensor_data_bucket_name" {
  description = "Name of the sensor data S3 bucket"
  value       = aws_s3_bucket.sensor_data_bucket.id
}

output "analytics_bucket_name" {
  description = "Name of the analytics data S3 bucket"
  value       = aws_s3_bucket.analytics_bucket.id
}

output "backup_bucket_name" {
  description = "Name of the backup S3 bucket"
  value       = aws_s3_bucket.backup_bucket.id
}

output "assets_bucket_name" {
  description = "Name of the assets S3 bucket"
  value       = aws_s3_bucket.assets_bucket.id
}