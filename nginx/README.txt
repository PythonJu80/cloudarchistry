NGINX HTTPS SETUP
=================

QUICK START (Development/Testing):
1. cd nginx
2. chmod +x generate-self-signed-cert.sh
3. ./generate-self-signed-cert.sh
4. Update cloud-academy/.env: NEXT_PUBLIC_LEARNING_AGENT_URL=https://your-domain.com

PRODUCTION:
1. Get real SSL certificates (Let's Encrypt recommended)
2. Copy cert.pem and key.pem to nginx/ssl/
3. Update nginx.conf server_name to your actual domain
4. Update cloud-academy/.env: NEXT_PUBLIC_LEARNING_AGENT_URL=https://cloudarchistry.com

PORTS:
- 680 -> HTTP (redirects to HTTPS)
- 6443 -> HTTPS (main entry point)

All /api/learning/* requests will be proxied to learning-agent:1027
All other requests will be proxied to cloud-academy:6060
