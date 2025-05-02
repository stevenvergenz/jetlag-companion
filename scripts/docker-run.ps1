#Requires -Version 7
$root = Resolve-Path "$PSScriptRoot/.."

docker run --rm `
    --name "jetlag" `
    -v "$root/dist:/usr/share/nginx/html:ro" `
    -p "8080:80" `
    "nginx:1.27-alpine"
