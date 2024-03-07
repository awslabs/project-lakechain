FROM node:lts-alpine

# Install Build Dependencies for the docker image. 
RUN apk add --no-cache --virtual .gyp \
  python3 \
  make \
  g++ \
  ffmpeg

# copy the application files
COPY app .

# Install application dependencies
RUN npm install

COPY run.sh run.sh
RUN ["chmod", "+x", "run.sh"]

ENTRYPOINT [ "/bin/bash", "run.sh" ]
