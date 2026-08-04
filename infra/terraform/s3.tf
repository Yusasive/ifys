# Student ID uploads. Private bucket — access only via short-lived signed
# URLs minted by StorageService (backend/src/storage/storage.service.ts).
resource "aws_s3_bucket" "uploads" {
  bucket = "${local.prefix}-uploads"

  tags = { Name = "${local.prefix}-uploads" }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# The registration form PUTs the student ID file directly from the browser
# to a presigned URL — the bucket must allow cross-origin PUT from the
# frontend's origin for that request to succeed.
resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  cors_rule {
    allowed_methods = ["PUT"]
    allowed_origins  = var.cors_allowed_origins
    allowed_headers  = ["Content-Type"]
    max_age_seconds  = 3000
  }
}
