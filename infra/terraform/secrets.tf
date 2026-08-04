# ── Infrastructure secrets (Terraform-managed) ───────────────────────────────
# DATABASE_URL and REDIS_URL are computed from RDS/ElastiCache endpoints.
# They are stored in Secrets Manager so the plaintext password never appears
# in the ECS task definition JSON.

resource "aws_secretsmanager_secret" "infra" {
  name                    = "${var.app_name}/${var.environment}/infra"
  description             = "Database and cache connection strings — managed by Terraform"
  recovery_window_in_days = local.is_production ? 7 : 0
}

resource "aws_secretsmanager_secret_version" "infra" {
  secret_id = aws_secretsmanager_secret.infra.id

  # aws_db_instance.endpoint returns "hostname:port". RDS's default
  # parameter group only accepts SSL connections (pg_hba.conf is
  # hostssl-only), so sslmode is required. Plain `sslmode=require` is
  # treated as an alias for verify-full by this pg-connection-string
  # version, which then fails because Node doesn't trust Amazon's RDS CA
  # — uselibpqcompat=true restores the classic libpq meaning of `require`
  # (encrypt the connection, don't verify the cert against a CA bundle).
  secret_string = jsonencode({
    DATABASE_URL = "postgresql://ify:${var.db_password}@${aws_db_instance.postgres.endpoint}/ify_summit?schema=public&sslmode=require&uselibpqcompat=true"
    REDIS_URL    = "redis://${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379"
  })
}

# ── Application secrets (user-managed) ───────────────────────────────────────
# Terraform creates the secret container. Fill the actual values via the
# AWS Console or CLI after `terraform apply`:
#
#   aws secretsmanager put-secret-value \
#     --secret-id ify-summit/production/app \
#     --secret-string '{
#       "JWT_SECRET":                "$(openssl rand -hex 32)",
#       "FLUTTERWAVE_SECRET_KEY":    "FLWSECK-...",
#       "FLUTTERWAVE_WEBHOOK_HASH":  "...",
#       "SMTP_PASSWORD":             "your_zoho_app_password"
#     }'

resource "aws_secretsmanager_secret" "app" {
  name                    = "${var.app_name}/${var.environment}/app"
  description             = "Application secrets — fill manually after first terraform apply"
  recovery_window_in_days = local.is_production ? 7 : 0
}
