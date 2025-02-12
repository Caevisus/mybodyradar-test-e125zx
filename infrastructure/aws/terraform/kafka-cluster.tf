# AWS Provider configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Variables for MSK configuration
variable "kafka_version" {
  type        = string
  description = "Kafka version for MSK cluster"
  default     = "3.5.1"
  validation {
    condition     = can(regex("^[2-3]\\.[0-9]+\\.[0-9]+$", var.kafka_version))
    error_message = "Kafka version must be in format X.Y.Z"
  }
}

variable "broker_instance_type" {
  type        = string
  description = "Instance type for Kafka brokers"
  default     = "kafka.m5.2xlarge"
  validation {
    condition     = can(regex("^kafka\\.(t3|m5|r5)\\.[\\w]+$", var.broker_instance_type))
    error_message = "Invalid broker instance type"
  }
}

variable "broker_count" {
  type        = number
  description = "Number of Kafka brokers per AZ"
  default     = 2
  validation {
    condition     = var.broker_count >= 2 && var.broker_count <= 5
    error_message = "Broker count must be between 2 and 5 per AZ"
  }
}

variable "volume_size" {
  type        = number
  description = "EBS volume size in GB for each broker"
  default     = 1000
  validation {
    condition     = var.volume_size >= 100 && var.volume_size <= 16384
    error_message = "Volume size must be between 100 and 16384 GB"
  }
}

# KMS key for encryption
resource "aws_kms_key" "kafka" {
  description             = "KMS key for MSK cluster encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Name        = "${var.project}-kafka-${var.environment}"
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "terraform"
  }
}

# Security group for Kafka cluster
resource "aws_security_group" "kafka" {
  name_prefix = "${var.project}-kafka-${var.environment}"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 9094
    to_port         = 9094
    protocol        = "tcp"
    security_groups = []  # Add application security groups here
    description     = "TLS client traffic"
  }

  ingress {
    from_port       = 9092
    to_port         = 9092
    protocol        = "tcp"
    self            = true
    description     = "Inter-broker communication"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project}-kafka-sg-${var.environment}"
    Environment = var.environment
    Project     = var.project
  }
}

# CloudWatch Log Group for Kafka broker logs
resource "aws_cloudwatch_log_group" "kafka" {
  name              = "/aws/msk/${var.project}-${var.environment}"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Project     = var.project
  }
}

# Kinesis Firehose for Kafka broker logs
resource "aws_kinesis_firehose_delivery_stream" "kafka_logs" {
  name        = "${var.project}-kafka-logs-${var.environment}"
  destination = "s3"

  s3_configuration {
    role_arn   = aws_iam_role.firehose.arn
    bucket_arn = aws_s3_bucket.kafka_logs.arn
    prefix     = "kafka-logs/"
  }

  tags = {
    Environment = var.environment
    Project     = var.project
  }
}

# S3 bucket for Kafka logs
resource "aws_s3_bucket" "kafka_logs" {
  bucket = "${var.project}-kafka-logs-${var.environment}"

  tags = {
    Environment = var.environment
    Project     = var.project
  }
}

# MSK cluster configuration
resource "aws_msk_configuration" "kafka" {
  name              = "${var.project}-config-${var.environment}"
  kafka_versions    = [var.kafka_version]
  server_properties = <<PROPERTIES
auto.create.topics.enable=false
default.replication.factor=3
min.insync.replicas=2
num.io.threads=8
num.network.threads=5
num.partitions=6
num.replica.fetchers=2
replica.lag.time.max.ms=30000
socket.receive.buffer.bytes=102400
socket.request.max.bytes=104857600
socket.send.buffer.bytes=102400
unclean.leader.election.enable=false
zookeeper.session.timeout.ms=18000
PROPERTIES
}

# MSK cluster
resource "aws_msk_cluster" "main" {
  cluster_name           = "${var.project}-${var.environment}"
  kafka_version         = var.kafka_version
  number_of_broker_nodes = var.broker_count * 3

  broker_node_group_info {
    instance_type   = var.broker_instance_type
    client_subnets  = var.private_subnet_ids
    security_groups = [aws_security_group.kafka.id]

    storage_info {
      ebs_storage_info {
        volume_size = var.volume_size
        provisioned_throughput {
          enabled           = true
          volume_throughput = 250
        }
      }
    }

    connectivity_info {
      public_access {
        type = "DISABLED"
      }
    }
  }

  encryption_info {
    encryption_at_rest_kms_key_arn = aws_kms_key.kafka.arn
    encryption_in_transit {
      client_broker = "TLS"
      in_cluster    = true
    }
  }

  configuration_info {
    arn      = aws_msk_configuration.kafka.arn
    revision = 1
  }

  open_monitoring {
    prometheus {
      jmx_exporter {
        enabled_in_broker = true
      }
      node_exporter {
        enabled_in_broker = true
      }
    }
  }

  logging_info {
    broker_logs {
      cloudwatch_logs {
        enabled   = true
        log_group = aws_cloudwatch_log_group.kafka.name
      }
      firehose {
        enabled         = true
        delivery_stream = aws_kinesis_firehose_delivery_stream.kafka_logs.name
      }
    }
  }

  tags = {
    Name              = "${var.project}-kafka-${var.environment}"
    Environment       = var.environment
    Project           = var.project
    ManagedBy         = "terraform"
    SecurityLevel     = "high"
    DataClassification = "sensitive"
  }
}

# Outputs
output "kafka_bootstrap_brokers_tls" {
  description = "TLS connection host:port pairs"
  value       = aws_msk_cluster.main.bootstrap_brokers_tls
}

output "kafka_cluster_arn" {
  description = "MSK cluster ARN"
  value       = aws_msk_cluster.main.arn
}

output "kafka_zookeeper_connect_string" {
  description = "Zookeeper connection string"
  value       = aws_msk_cluster.main.zookeeper_connect_string
}