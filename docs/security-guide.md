# Security Guide

V1 is intended for localhost and trusted local environments.

Safety defaults:

- admin area requires a password
- admin password is hashed
- session cookie is HTTP-only
- mutating admin APIs require CSRF token
- API keys are encrypted locally
- backups exclude secret values
- AI Actions cannot run arbitrary commands
- uploaded files are limited to PDF, images, text, Markdown, and JSON

Do not expose V1 directly to the public internet without HTTPS, firewall rules, stronger authentication, and an operational review.

