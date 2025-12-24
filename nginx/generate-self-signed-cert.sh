#!/bin/bash
# Generate self-signed SSL certificate for development/testing
# For production, use Let's Encrypt or your own certificates

mkdir -p ssl

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem \
  -out ssl/cert.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=cloudarchistry.com"

chmod 600 ssl/key.pem
chmod 644 ssl/cert.pem

echo "✅ Self-signed certificate generated in ssl/"
echo "⚠️  For production, replace with real SSL certificates"
