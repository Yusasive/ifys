# IFY Summit backend — AWS deployment

Terraform in `infra/terraform/` provisions everything the backend needs on
AWS: VPC, RDS Postgres, ElastiCache Redis, S3 (student ID uploads), ECR,
and an ECS Fargate service behind an ALB. `backend/Dockerfile` builds the
image that gets deployed there.

This uses the same AWS account as `infaq-backend` — every resource name is
prefixed `ify-summit-production-*` so nothing collides, and the VPC CIDR
(`10.20.0.0/16`) is distinct from infaq's ranges in case they're ever peered.

No custom domain is wired up yet — the ALB gets a random `*.elb.amazonaws.com`
DNS name and serves plain HTTP. See "Adding HTTPS" below for when you're
ready to point a real domain at it.

## One-time bootstrap

1. **Terraform state bucket** (holds `terraform.tfstate` — create once, never
   destroy):

   ```bash
   aws s3api create-bucket --bucket ify-summit-terraform-state --region us-east-1
   aws s3api put-bucket-versioning \
     --bucket ify-summit-terraform-state \
     --versioning-configuration Status=Enabled
   ```

2. **Init Terraform**:

   ```bash
   cd infra/terraform
   terraform init
   ```

3. **Pick a database password** and apply:

   ```bash
   terraform apply -var="db_password=$(openssl rand -base64 24)"
   ```

   Terraform will print the ALB URL, ECR repo, ECS cluster/service names,
   and the deploy user's access keys. Save the `db_password` you used
   somewhere safe (a password manager) — you'll need it if you ever run
   `terraform apply` again and it's not stored in state in plaintext by
   design.

4. **Fill in application secrets** (Terraform only creates the Secrets
   Manager container — the values are yours to set):

   ```bash
   aws secretsmanager put-secret-value \
     --secret-id ify-summit/production/app \
     --secret-string '{
       "JWT_SECRET": "'"$(openssl rand -hex 32)"'",
       "FLUTTERWAVE_SECRET_KEY": "FLWSECK-...",
       "FLUTTERWAVE_WEBHOOK_HASH": "...",
       "SMTP_USER": "contact@ifysummit.com",
       "SMTP_PASSWORD": "your_zoho_app_password"
     }'
   ```

5. **Build and push the first image** (the ECS service won't have anything
   to run until an image with tag `latest` exists in ECR):

   ```bash
   cd ../..   # repo root
   aws ecr get-login-password --region us-east-1 \
     | docker login --username AWS --password-stdin "$(terraform -chdir=infra/terraform output -raw ecr_repository_url | cut -d/ -f1)"
   # --platform linux/amd64 is required if you're building on Apple
   # Silicon — Fargate can't pull an arm64-only image (ECS fails the task
   # with CannotPullContainerError: "no descriptor matching linux/amd64").
   docker build --platform linux/amd64 -f backend/Dockerfile \
     -t "$(terraform -chdir=infra/terraform output -raw ecr_repository_url):latest" .
   docker push "$(terraform -chdir=infra/terraform output -raw ecr_repository_url):latest"
   ```

   The ECS service will start pulling this image automatically (it was
   created pointing at the `latest` tag). Check task status:

   ```bash
   aws ecs describe-services \
     --cluster "$(terraform -chdir=infra/terraform output -raw ecs_cluster_name)" \
     --services "$(terraform -chdir=infra/terraform output -raw ecs_service_name)"
   ```

6. **Wire up GitHub Actions** for future deploys — under repo
   Settings → Environments → `production`, add these secrets:

   | Secret | Value |
   |---|---|
   | `AWS_ACCESS_KEY_ID` | `terraform output -raw deploy_user_access_key_id` |
   | `AWS_SECRET_ACCESS_KEY` | `terraform output -raw deploy_user_secret_access_key` |
   | `AWS_REGION` | `us-east-1` |
   | `ECR_REPOSITORY_URL` | `terraform output -raw ecr_repository_url` |
   | `ECS_CLUSTER` | `terraform output -raw ecs_cluster_name` |
   | `ECS_SERVICE` | `terraform output -raw ecs_service_name` |
   | `ECS_TASK_DEFINITION` | `terraform output -raw ecs_task_definition_family` |

   After that, every push to `main` touching `backend/**` runs
   `.github/workflows/deploy.yml` — builds the image, pushes to ECR, and
   rolls the ECS service.

7. **Point the frontend at the new API**: set `NEXT_PUBLIC_API_URL` on
   Netlify to `http://<alb_dns_name>` (from `terraform output alb_dns_name`).

## Day-to-day

- **Redeploy**: push to `main`, or run the `Deploy backend to ECS` workflow
  manually from the Actions tab.
- **Migrations**: run automatically — the container's startup command is
  `prisma migrate deploy && node dist/main.js`. `desired_count` is 1, so
  there's no race between replicas both trying to apply the same migration
  concurrently. If you ever raise `desired_count`, move migrations to a
  separate one-off `aws ecs run-task` step in the deploy workflow instead
  (see infaq-backend's `deploy-staging` job for the pattern).
- **Seed the database** (only needed once, or after a fresh RDS instance):
  run `prisma db seed` the same way as migrations — as a one-off ECS task,
  overriding the container command:

  ```bash
  aws ecs run-task \
    --cluster "$(terraform -chdir=infra/terraform output -raw ecs_cluster_name)" \
    --task-definition "$(terraform -chdir=infra/terraform output -raw ecs_task_definition_family)" \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[<private-subnet-ids>],securityGroups=[<ecs-sg-id>]}" \
    --overrides '{"containerOverrides":[{"name":"ify-summit-production-api","command":["npx","prisma","db","seed"]}]}'
  ```

  (Subnet and security group IDs: `terraform output` doesn't expose them by
  default — pull them from `aws ec2 describe-subnets` / the AWS Console, or
  add outputs for them if you'll do this often.)

- **Logs**: CloudWatch Logs group `/ecs/ify-summit-production-api`.
- **Tear down**: `terraform destroy -var="db_password=..."` — this deletes
  everything Terraform created, including RDS (a final snapshot is taken
  first) and the S3 bucket (⚠️ only if empty — empty it first if it has
  uploaded files you want to keep, or accept the delete `force_destroy`
  isn't set, so Terraform will refuse to delete a non-empty bucket).

## Adding HTTPS later

Once you have a domain:

1. Request a certificate in ACM for e.g. `api.ifysummit.ng` (DNS
   validation).
2. Set `terraform apply -var="acm_certificate_arn=<cert-arn>" ...` — this
   repo's `alb.tf` currently only wires up an HTTP listener; you'd add an
   `aws_lb_listener "https"` block (port 443, using
   `var.acm_certificate_arn`) and change the HTTP listener to redirect to
   HTTPS, mirroring infaq-backend's `infra/terraform/alb.tf`.
3. Point the domain's DNS at the ALB (`alb_dns_name` output) via a CNAME
   or Route 53 alias record.
4. Update `NEXT_PUBLIC_API_URL` on Netlify and `FRONTEND_ORIGIN`/
   `CORS_ORIGIN` env vars to match.

## What's NOT covered here

- Custom domain / Route 53 / ACM (see above — deliberately deferred).
- Multi-AZ RDS / ElastiCache failover — `db_instance_class`/`redis_node_type`
  defaults are single-node, sized for an event-registration app's actual
  load, not high availability. Bump `num_cache_clusters` and enable RDS
  Multi-AZ if that changes.
- Staging environment — `environment` defaults to `production`; passing
  `-var="environment=staging"` would stand up a fully separate parallel
  stack (distinct resource names, its own VPC) if you want one later.
