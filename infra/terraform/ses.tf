# ── Amazon SES (outgoing email) ──────────────────────────────────────────────
# Verifies the sending domain and creates SMTP credentials for the API.
# Only outgoing mail goes through SES — the domain's MX records are untouched,
# so the existing mailbox provider keeps receiving mail.
#
# Rollout:
#   1. terraform apply (use_ses = false) — creates the identity and credentials.
#   2. Add the three CNAMEs from `terraform output ses_dkim_records` at the
#      domain's DNS host and wait for:
#        aws sesv2 get-email-identity --email-identity <ses_domain> \
#          --query DkimAttributes.Status        # → "SUCCESS"
#   3. Request production access (new accounts can only send to verified
#      addresses):
#        aws sesv2 put-account-details --production-access-enabled \
#          --mail-type TRANSACTIONAL --website-url https://ifysummit.com \
#          --use-case-description "Event tickets and attendee notifications" \
#          --contact-language EN
#   4. terraform apply -var="use_ses=true", then re-run the "Deploy backend
#      to ECS" workflow. The service ignores Terraform's task definition, so
#      the apply alone doesn't switch anything; the deploy starts from the
#      newest revision (this one) and puts it live with the current image.

resource "aws_sesv2_email_identity" "domain" {
  email_identity = var.ses_domain
}

# Dedicated IAM user whose access key doubles as the SES SMTP login. It can
# only send mail from the verified domain.
resource "aws_iam_user" "ses_smtp" {
  name = "${local.prefix}-ses-smtp"
  tags = { Name = "${local.prefix}-ses-smtp" }
}

resource "aws_iam_access_key" "ses_smtp" {
  user = aws_iam_user.ses_smtp.name
}

resource "aws_iam_user_policy" "ses_smtp" {
  name = "${local.prefix}-ses-smtp-policy"
  user = aws_iam_user.ses_smtp.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "SendFromDomain"
      Effect   = "Allow"
      Action   = ["ses:SendRawEmail"]
      Resource = aws_sesv2_email_identity.domain.arn
    }]
  })
}

# Kept in its own Terraform-managed secret so it never clobbers (or gets
# clobbered by) the hand-filled app secret.
resource "aws_secretsmanager_secret" "ses_smtp" {
  name                    = "${var.app_name}/${var.environment}/ses-smtp"
  description             = "SES SMTP credentials — managed by Terraform"
  recovery_window_in_days = local.is_production ? 7 : 0
}

resource "aws_secretsmanager_secret_version" "ses_smtp" {
  secret_id = aws_secretsmanager_secret.ses_smtp.id

  secret_string = jsonencode({
    SMTP_USER     = aws_iam_access_key.ses_smtp.id
    SMTP_PASSWORD = aws_iam_access_key.ses_smtp.ses_smtp_password_v4
  })
}
