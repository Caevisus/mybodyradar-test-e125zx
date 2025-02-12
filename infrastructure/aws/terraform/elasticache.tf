# ElastiCache Redis cluster configuration for smart-apparel system
# Implements multi-AZ deployment with cluster mode for high availability

# ElastiCache subnet group for Redis cluster
resource "aws_elasticache_subnet_group" "main" {
  name       = "smart-apparel-cache-subnet-${var.environment}"
  subnet_ids = data.aws_subnet.private[*].id

  tags = {
    Name        = "smart-apparel-cache-subnet-${var.environment}"
    Environment = var.environment
    Project     = "smart-apparel"
  }
}

# ElastiCache parameter group for Redis configuration
resource "aws_elasticache_parameter_group" "main" {
  family      = "redis7.0"
  name        = "smart-apparel-cache-params-${var.environment}"
  description = "ElastiCache parameter group for smart-apparel system"

  # Performance and reliability parameters
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"  # Least Recently Used eviction policy
  }

  parameter {
    name  = "timeout"
    value = "300"  # Connection timeout in seconds
  }

  parameter {
    name  = "maxclients"
    value = "65000"  # Maximum concurrent connections
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"  # TCP keepalive interval
  }

  parameter {
    name  = "activedefrag"
    value = "yes"  # Enable active defragmentation
  }

  tags = {
    Name        = "smart-apparel-cache-params-${var.environment}"
    Environment = var.environment
  }
}

# Generate random auth token for Redis
resource "random_password" "redis_auth" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
  min_special      = 2
  min_upper        = 2
  min_lower        = 2
  min_numeric      = 2
}

# ElastiCache replication group for Redis cluster
resource "aws_elasticache_replication_group" "main" {
  replication_group_id          = "smart-apparel-cache-${var.environment}"
  replication_group_description = "Smart Apparel Redis cluster for real-time data caching"
  
  # Node configuration
  node_type                     = var.elasticache_node_type
  number_cache_clusters         = var.elasticache_num_cache_nodes
  port                         = 6379
  
  # Network and security
  parameter_group_name         = aws_elasticache_parameter_group.main.name
  subnet_group_name           = aws_elasticache_subnet_group.main.name
  security_group_ids          = [aws_security_group.redis.id]
  
  # High availability settings
  automatic_failover_enabled  = true
  multi_az_enabled           = true
  
  # Engine configuration
  engine                     = "redis"
  engine_version             = "7.0"
  
  # Encryption and security
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                = random_password.redis_auth.result
  
  # Maintenance and backup
  maintenance_window         = "sun:05:00-sun:09:00"
  snapshot_window           = "00:00-04:00"
  snapshot_retention_limit  = 7
  auto_minor_version_upgrade = true
  
  # Monitoring
  notification_topic_arn    = aws_sns_topic.cache_alerts.arn

  tags = {
    Name        = "smart-apparel-cache-${var.environment}"
    Environment = var.environment
    Project     = "smart-apparel"
  }
}

# Security group for Redis cluster
resource "aws_security_group" "redis" {
  name        = "smart-apparel-redis-${var.environment}"
  description = "Security group for Redis cluster"
  vpc_id      = data.aws_vpc.main.id

  # Inbound rule for Redis access
  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = data.aws_subnet.private[*].cidr_block
    description = "Redis access from private subnets"
  }

  # Outbound rule
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name        = "smart-apparel-redis-sg-${var.environment}"
    Environment = var.environment
  }
}

# SNS topic for cache alerts
resource "aws_sns_topic" "cache_alerts" {
  name = "smart-apparel-cache-alerts-${var.environment}"
  
  tags = {
    Name        = "smart-apparel-cache-alerts-${var.environment}"
    Environment = var.environment
  }
}

# Outputs
output "redis_endpoint" {
  description = "Primary endpoint for Redis cluster"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "redis_port" {
  description = "Port number for Redis cluster"
  value       = aws_elasticache_replication_group.main.port
}

output "redis_auth_token" {
  description = "Authentication token for Redis cluster"
  value       = random_password.redis_auth.result
  sensitive   = true
}