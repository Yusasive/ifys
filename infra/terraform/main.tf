terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Pre-create the state bucket once (see infra/README.md), then:
  #   terraform init
  backend "s3" {
    bucket       = "ify-summit-terraform-state"
    region       = "us-east-1"
    key          = "backend/terraform.tfstate"
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.app_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

locals {
  # Prefixes every resource name so this can coexist with other apps
  # (e.g. infaq) in the same AWS account without name collisions.
  prefix        = "${var.app_name}-${var.environment}"
  is_production = var.environment == "production"
}
