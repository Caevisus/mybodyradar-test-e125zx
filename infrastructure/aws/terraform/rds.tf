# RDS Configuration for Smart Apparel System
# AWS Provider version ~> 5.0

# RDS Subnet Group
resource "aws_db_subnet_group" "main" {
  name        = "smart-apparel-${var.environment}"
  description = "RDS subnet group for Smart Apparel ${var.environment} environment"
  subnet_ids  = aws_subnet.private[*].id

  tags = {
    Name        = "smart-apparel-db-subnet-${var.environment}"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# RDS Parameter Group
resource "aws_db_parameter_group" "main" {
  family = "mysql8.0"
  name   = "smart-apparel-params-${var.environment}"

  parameter {
    name  = "max_connections"
    value = "1000"
  }

  parameter {
    name  = "innodb_buffer_pool_size"
    value = "{DBInstanceClassMemory*3/4}"
  }

  parameter {
    name  = "max_allowed_packet"
    value = "67108864"
  }

  parameter {
    name  = "innodb_read_io_threads"
    value = "8"
  }

  parameter {
    name  = "slow_query_log"
    value = "1"
  }

  parameter {
    name  = "long_query_time"
    value = "2"
  }

  tags = {
    Name        = "smart-apparel-params-${var.environment}"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# IAM Role for Enhanced Monitoring
resource "aws_iam_role" "rds_enhanced_monitoring" {
  name = "smart-apparel-rds-monitoring-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "smart-apparel-rds-monitoring-${var.environment}"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Attach Enhanced Monitoring Policy
resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  role       = aws_iam_role.rds_enhanced_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Primary RDS Instance
resource "aws_db_instance" "main" {
  identifier     = "smart-apparel-${var.environment}"
  engine         = "mysql"
  engine_version = var.rds_configuration[var.environment].engine_version

  instance_class    = var.rds_configuration[var.environment].instance_class
  allocated_storage = var.rds_configuration[var.environment].allocated_storage
  storage_type      = var.rds_configuration[var.environment].storage_type

  db_name  = "smart_apparel"
  username = "admin"
  password = random_password.db_password.result

  multi_az               = var.rds_configuration[var.environment].multi_az
  db_subnet_group_name   = aws_db_subnet_group.main.name
  parameter_group_name   = aws_db_parameter_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = var.rds_configuration[var.environment].backup_retention
  backup_window          = var.rds_configuration[var.environment].backup_window
  maintenance_window     = "Mon:04:00-Mon:05:00"

  auto_minor_version_upgrade = true
  deletion_protection       = true
  skip_final_snapshot      = false
  final_snapshot_identifier = "smart-apparel-final-${var.environment}-${formatdate("YYYY-MM-DD", timestamp())}"

  storage_encrypted = true
  kms_key_id       = aws_kms_key.rds.arn

  monitoring_interval             = 30
  monitoring_role_arn            = aws_iam_role.rds_enhanced_monitoring.arn
  performance_insights_enabled    = true
  performance_insights_retention_period = 7

  enabled_cloudwatch_logs_exports = ["error", "general", "slowquery", "audit"]
  
  iam_database_authentication_enabled = true
  network_type                       = "IPV4"
  copy_tags_to_snapshot             = true

  tags = {
    Name        = "smart-apparel-db-${var.environment}"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Read Replica Instance
resource "aws_db_instance" "replica" {
  identifier     = "smart-apparel-replica-${var.environment}"
  instance_class = var.rds_configuration[var.environment].instance_class
  
  replicate_source_db = aws_db_instance.main.id

  auto_minor_version_upgrade = true
  multi_az                  = false
  vpc_security_group_ids    = [aws_security_group.rds.id]

  monitoring_interval             = 30
  monitoring_role_arn            = aws_iam_role.rds_enhanced_monitoring.arn
  performance_insights_enabled    = true
  performance_insights_retention_period = 7

  copy_tags_to_snapshot = true

  tags = {
    Name        = "smart-apparel-db-replica-${var.environment}"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# RDS Security Group
resource "aws_security_group" "rds" {
  name        = "smart-apparel-rds-${var.environment}"
  description = "Security group for RDS instances"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  tags = {
    Name        = "smart-apparel-rds-sg-${var.environment}"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# KMS Key for RDS Encryption
resource "aws_kms_key" "rds" {
  description             = "KMS key for RDS encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Name        = "smart-apparel-rds-kms-${var.environment}"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Random password generation for RDS
resource "random_password" "db_password" {
  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Store RDS password in Secrets Manager
resource "aws_secretsmanager_secret" "rds_password" {
  name = "smart-apparel-rds-password-${var.environment}"
  kms_key_id = aws_kms_key.rds.arn

  tags = {
    Name        = "smart-apparel-rds-secret-${var.environment}"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_secretsmanager_secret_version" "rds_password" {
  secret_id     = aws_secretsmanager_secret.rds_password.id
  secret_string = random_password.db_password.result
}

# Outputs
output "rds_endpoint" {
  description = "The connection endpoint for the primary RDS instance"
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

output "rds_replica_endpoint" {
  description = "The connection endpoint for the RDS read replica"
  value       = aws_db_instance.replica.endpoint
  sensitive   = true
}

output "rds_secret_arn" {
  description = "The ARN of the secret storing the RDS password"
  value       = aws_secretsmanager_secret.rds_password.arn
  sensitive   = true
}