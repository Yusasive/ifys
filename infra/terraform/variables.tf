variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "app_name" {
  description = "Application name used to namespace all resources"
  type        = string
  default     = "ify-summit"
}

variable "environment" {
  description = "Deployment environment (staging | production)"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production"
  }
}

variable "db_password" {
  description = "Master password for the RDS PostgreSQL instance"
  type        = string
  sensitive   = true
}

variable "fargate_cpu" {
  description = "CPU units for the Fargate task (256 | 512 | 1024 | 2048 | 4096)"
  type        = number
  default     = 256
}

variable "fargate_memory" {
  description = "Memory (MiB) for the Fargate task — must be compatible with fargate_cpu"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Number of ECS task replicas to run"
  type        = number
  default     = 1
}

variable "app_image_tag" {
  description = "Docker image tag to use in the initial task definition (GitHub Actions overrides this on each deploy)"
  type        = string
  default     = "latest"
}

variable "db_instance_class" {
  description = "RDS instance class (db.t4g.micro = ~$12/month)"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_deletion_protection" {
  description = "Prevent the RDS instance from being deleted via a plain `terraform destroy`/apply. Defaults on since this is the production attendee/payment database — a final snapshot is still taken regardless (see skip_final_snapshot in rds.tf)."
  type        = bool
  default     = true
}

variable "redis_node_type" {
  description = "ElastiCache node type (cache.t4g.micro = ~$11/month)"
  type        = string
  default     = "cache.t4g.micro"
}

variable "vpc_cidr" {
  description = "VPC CIDR block — kept distinct from other apps' VPCs in this account so they could be peered later without conflict"
  type        = string
  default     = "10.20.0.0/16"
}

variable "acm_certificate_arn" {
  description = "ARN of an ACM certificate for the HTTPS listener. Leave blank to run HTTP-only (fine for an AWS-generated ALB URL with no custom domain yet)."
  type        = string
  default     = ""
}

variable "cors_allowed_origins" {
  description = "Origins allowed to call the API and to PUT directly to the S3 bucket (student ID uploads)"
  type        = list(string)
  default     = ["https://ifysummit.com"]
}

variable "frontend_origin" {
  description = "Frontend origin used to build payment callback URLs (FRONTEND_ORIGIN env var)"
  type        = string
  default     = "https://ifysummit.com"
}
