# Provider configuration with version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for enhanced configuration
locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  # Enhanced endpoint configurations with specific throttling
  api_endpoints = {
    sensor = {
      path     = "/api/v1/sensor"
      methods  = ["GET", "POST"]
      throttling = {
        rate  = 100
        burst = 200
      }
    }
    session = {
      path     = "/api/v1/session"
      methods  = ["GET", "POST", "PUT"]
      throttling = {
        rate  = 50
        burst = 100
      }
    }
    analytics = {
      path     = "/api/v1/analytics"
      methods  = ["GET"]
      throttling = {
        rate  = 30
        burst = 50
      }
    }
    alerts = {
      path     = "/api/v1/alerts"
      methods  = ["GET", "POST"]
      throttling = {
        rate  = 20
        burst = 40
      }
    }
  }

  # Enhanced CORS configuration with strict security
  cors_configuration = {
    allow_origins     = ["https://*.smart-apparel.com"]
    allow_methods     = ["GET", "POST", "PUT", "DELETE"]
    allow_headers     = ["Content-Type", "Authorization", "X-Amz-Date", "X-Api-Key", "X-Amz-Security-Token"]
    expose_headers    = ["X-Request-Id"]
    max_age          = 7200
    allow_credentials = true
  }
}

# REST API Gateway with enhanced security and monitoring
resource "aws_api_gateway_rest_api" "main" {
  name        = "${var.project_name}-rest-api"
  description = "Smart Apparel System REST API"

  endpoint_configuration {
    types            = ["REGIONAL"]
    vpc_endpoint_ids = [aws_vpc_endpoint.api_gateway.id]
  }

  minimum_compression_size = 1024
  binary_media_types      = ["application/octet-stream", "application/json"]
  api_key_source         = "HEADER"

  tags = local.common_tags
}

# WebSocket API Gateway for real-time data
resource "aws_apigatewayv2_api" "websocket" {
  name                       = "${var.project_name}-websocket"
  protocol_type             = "WEBSOCKET"
  route_selection_expression = "$request.body.action"

  tags = local.common_tags
}

# WAF Web ACL with comprehensive security rules
resource "aws_wafv2_web_acl" "api_gateway" {
  count = var.security_configuration["enable_waf"] ? 1 : 0

  name        = "${var.project_name}-waf"
  description = "WAF rules for API Gateway protection"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # Rate limiting rule
  rule {
    name     = "RateLimit"
    priority = 1

    override_action {
      none {}
    }

    statement {
      rate_based_statement {
        limit              = var.security_configuration["waf_rate_limit"]
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "${var.project_name}-rate-limit"
      sampled_requests_enabled  = true
    }
  }

  # SQL injection protection
  rule {
    name     = "SQLInjectionProtection"
    priority = 2

    override_action {
      none {}
    }

    statement {
      sql_injection_match_statement {
        field_to_match {
          body {}
        }
        text_transformation {
          priority = 1
          type     = "URL_DECODE"
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "${var.project_name}-sql-injection"
      sampled_requests_enabled  = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name               = "${var.project_name}-waf"
    sampled_requests_enabled  = true
  }

  tags = local.common_tags
}

# Custom authorizer for enhanced JWT validation
resource "aws_api_gateway_authorizer" "jwt" {
  name                   = "${var.project_name}-jwt-authorizer"
  rest_api_id            = aws_api_gateway_rest_api.main.id
  type                   = "JWT"
  identity_source        = "$request.header.Authorization"
  provider_arns          = [aws_cognito_user_pool.main.arn]
  authorizer_uri         = aws_lambda_function.custom_authorizer.invoke_arn
  authorizer_credentials = aws_iam_role.authorizer.arn
  ttl                    = 300
}

# API Gateway stage with monitoring and logging
resource "aws_api_gateway_stage" "main" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.main.id
  stage_name    = var.api_gateway_configuration["stage_name"]

  xray_tracing_enabled = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format         = jsonencode({
      requestId    = "$context.requestId"
      ip          = "$context.identity.sourceIp"
      caller      = "$context.identity.caller"
      user        = "$context.identity.user"
      requestTime = "$context.requestTime"
      httpMethod  = "$context.httpMethod"
      resourcePath = "$context.resourcePath"
      status      = "$context.status"
      protocol    = "$context.protocol"
      responseLength = "$context.responseLength"
    })
  }

  tags = local.common_tags
}

# Outputs for API endpoints
output "rest_api_url" {
  description = "REST API Gateway endpoint URL"
  value       = aws_api_gateway_stage.main.invoke_url
}

output "websocket_url" {
  description = "WebSocket API Gateway endpoint URL"
  value       = aws_apigatewayv2_api.websocket.api_endpoint
}