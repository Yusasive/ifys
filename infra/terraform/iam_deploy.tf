# ── GitHub Actions CI/CD Deploy User ─────────────────────────────────────────
# Least-privilege IAM user used by GitHub Actions to push Docker images to ECR
# and trigger ECS rolling deployments.
#
# After `terraform apply`, retrieve the credentials with:
#   terraform output -raw deploy_user_access_key_id
#   terraform output -raw deploy_user_secret_access_key
#
# Then set them as GitHub Actions environment secrets named:
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY

data "aws_caller_identity" "current" {}

resource "aws_iam_user" "deploy" {
  name = "${local.prefix}-deploy"
  tags = { Name = "${local.prefix}-deploy" }
}

resource "aws_iam_access_key" "deploy" {
  user = aws_iam_user.deploy.name
}

resource "aws_iam_user_policy" "deploy" {
  name = "${local.prefix}-deploy-policy"
  user = aws_iam_user.deploy.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ECRAuth"
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Sid    = "ECRPush"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage",
        ]
        Resource = aws_ecr_repository.api.arn
      },
      {
        Sid    = "ECSTaskDef"
        Effect = "Allow"
        Action = [
          "ecs:RegisterTaskDefinition",
          "ecs:DescribeTaskDefinition",
        ]
        Resource = "*"
      },
      {
        Sid    = "ECSServiceUpdate"
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices",
        ]
        Resource = "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:service/${local.prefix}-cluster/${local.prefix}-api-service"
      },
      {
        Sid    = "PassRoles"
        Effect = "Allow"
        Action = ["iam:PassRole"]
        Resource = [
          aws_iam_role.ecs_task_execution.arn,
          aws_iam_role.ecs_task.arn,
        ]
      },
    ]
  })
}
