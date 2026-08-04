resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.prefix}-api"
  retention_in_days = 30
}

resource "aws_ecs_cluster" "main" {
  name = "${local.prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${local.prefix}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.fargate_cpu
  memory                   = var.fargate_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn             = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name  = "${local.prefix}-api"
    image = "${aws_ecr_repository.api.repository_url}:${var.app_image_tag}"

    portMappings = [{
      containerPort = 3000
      protocol      = "tcp"
    }]

    # Non-sensitive static configuration
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = "3000" },
      { name = "EVENT_SLUG", value = "ify-summit-2026" },
      { name = "CORS_ORIGIN", value = var.frontend_origin },
      { name = "FRONTEND_ORIGIN", value = var.frontend_origin },
      { name = "JWT_EXPIRES_IN", value = "28800" },
      { name = "S3_BUCKET", value = aws_s3_bucket.uploads.bucket },
      { name = "S3_REGION", value = var.aws_region },
      { name = "S3_ENDPOINT", value = "https://s3.${var.aws_region}.amazonaws.com" },
      { name = "S3_FORCE_PATH_STYLE", value = "false" },
      { name = "SMTP_HOST", value = "smtp.zoho.com" },
      { name = "SMTP_PORT", value = "465" },
      { name = "SMTP_FROM", value = "contact@ifysummit.com" },
      { name = "SUPPORT_EMAIL", value = "contact@ifysummit.com" },
    ]

    # Secrets fetched from Secrets Manager at task startup — never stored in task definition JSON
    secrets = [
      # Infrastructure (Terraform-managed)
      { name = "DATABASE_URL", valueFrom = "${aws_secretsmanager_secret.infra.arn}:DATABASE_URL::" },
      { name = "REDIS_URL", valueFrom = "${aws_secretsmanager_secret.infra.arn}:REDIS_URL::" },
      # Application (user-managed — fill via AWS Console or CLI after first apply)
      { name = "JWT_SECRET", valueFrom = "${aws_secretsmanager_secret.app.arn}:JWT_SECRET::" },
      { name = "FLUTTERWAVE_SECRET_KEY", valueFrom = "${aws_secretsmanager_secret.app.arn}:FLUTTERWAVE_SECRET_KEY::" },
      { name = "FLUTTERWAVE_WEBHOOK_HASH", valueFrom = "${aws_secretsmanager_secret.app.arn}:FLUTTERWAVE_WEBHOOK_HASH::" },
      { name = "SMTP_USER", valueFrom = "${aws_secretsmanager_secret.app.arn}:SMTP_USER::" },
      { name = "SMTP_PASSWORD", valueFrom = "${aws_secretsmanager_secret.app.arn}:SMTP_PASSWORD::" },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.api.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "wget -qO- http://localhost:3000/ || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])

  depends_on = [aws_secretsmanager_secret_version.infra]
}

resource "aws_ecs_service" "api" {
  name            = "${local.prefix}-api-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "${local.prefix}-api"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.http, aws_lb_listener.https]

  # GitHub Actions manages the task_definition ARN after each image push
  lifecycle {
    ignore_changes = [task_definition]
  }
}
