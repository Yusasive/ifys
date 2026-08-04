output "alb_dns_name" {
  description = "ALB DNS — set this as NEXT_PUBLIC_API_URL on the frontend (http://<this>), or point a domain's CNAME here later"
  value       = aws_lb.main.dns_name
}

output "ecr_repository_url" {
  description = "ECR repository URL — set as ECR_REPOSITORY_URL in GitHub Actions secrets"
  value       = aws_ecr_repository.api.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name — set as ECS_CLUSTER in GitHub Actions secrets"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name — set as ECS_SERVICE in GitHub Actions secrets"
  value       = aws_ecs_service.api.name
}

output "ecs_task_definition_family" {
  description = "ECS task definition family — set as ECS_TASK_DEFINITION in GitHub Actions secrets"
  value       = aws_ecs_task_definition.api.family
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint (host:port)"
  value       = aws_db_instance.postgres.endpoint
}

output "redis_primary_endpoint" {
  description = "ElastiCache Redis primary endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "s3_bucket_name" {
  description = "S3 bucket for student ID uploads"
  value       = aws_s3_bucket.uploads.bucket
}

output "app_secrets_arn" {
  description = "Secrets Manager ARN for the app secrets — fill this with your credentials"
  value       = aws_secretsmanager_secret.app.arn
}

output "deploy_user_access_key_id" {
  description = "GitHub Actions: set as AWS_ACCESS_KEY_ID"
  value       = aws_iam_access_key.deploy.id
}

output "deploy_user_secret_access_key" {
  description = "GitHub Actions: set as AWS_SECRET_ACCESS_KEY"
  value       = aws_iam_access_key.deploy.secret
  sensitive   = true
}
