#!/bin/sh
set -e
token=$(printf '%s' "${AUTH_TOKEN:-}" | sed 's/\\/\\\\/g; s/'"'"'/\\'"'"'/g')
echo "window.__AUTH_TOKEN__ = '${token}';" > /usr/share/nginx/html/config.js
exec nginx -g "daemon off;"
