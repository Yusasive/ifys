// Runs before every spec (jest "setupFiles"). backend/.env holds the real
// Gmail SMTP login for local dev, and specs load it via 'dotenv/config' —
// so without this, every `git push` (husky runs the tests) emailed real
// people through Gmail. dotenv never overwrites a variable that's already
// set, so pinning these here sends test mail to Mailpit
// (docker-compose.yml), the same as CI. Mailpit doesn't offer AUTH, so the
// Gmail SMTP_USER/SMTP_PASSWORD from .env are simply never used.
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_PORT = '1025';
process.env.SMTP_FROM = 'tickets@ifysummit.ng';
