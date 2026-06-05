#!/bin/bash

set -e

APPNAME=<%= appName %>
APP_DIR=/opt/$APPNAME
IMAGE_PREFIX=<%- imagePrefix %>
IMAGE=$IMAGE_PREFIX'<%= imageName %>'
BASE_IMAGE=node:<%= nodeVersion %>

set +e
sudo docker pull $BASE_IMAGE
set -e

cd $APP_DIR/tmp
sudo rm -rf bundle
mkdir bundle
sudo tar -xzf bundle.tar.gz -C bundle
sudo chmod 777 ./ -R
cd bundle

sudo cat <<EOT > Dockerfile
FROM node:<%= nodeVersion %>
RUN mkdir -p /home/node/app || true

WORKDIR /home/node/app

ENV <% for(var key in env) { %> \
  <%- key %>=<%- env[key] %> \
<% } %>

<% for(var instruction in buildInstructions) { %>
<%=  buildInstructions[instruction] %>
<% } %>

<% if (!prebuiltDependencies) { %>
COPY ./package.json ./package.json
<% if (packageLock) { %>
COPY ./package-lock.json ./package-lock.json
<% } %>
RUN npm install --unsafe-perm
<% } %>
COPY ./ ./

<% if(postInstallScript) { %>
RUN npm run mup:postinstall
<% } %>

CMD [ "npm", "run", "<%= startScript %>" ]
EOT

sudo chmod 777 ./Dockerfile
echo "Building image"
sudo docker build -t $IMAGE:build .
sudo rm -rf bundle
sudo docker tag $IMAGE:latest $IMAGE:previous || true
sudo docker tag $IMAGE:build $IMAGE:latest
sudo docker image prune -f

<% if (privateRegistry) { %>
  echo "Pushing images to private registry"
  # Fails if the previous tag doesn't exist (such as during the initial deploy)
  sudo docker push $IMAGE:previous || true

  sudo docker push $IMAGE:latest
<% } %>
