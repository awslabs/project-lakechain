FROM node:lts-alpine

# Install Build Dependencies for the docker image. 
RUN apk add --no-cache --virtual \
  bash \
  ffmpeg

# Copy the application files
COPY app .

# Install application dependencies
RUN npm install

# Start the application
ENTRYPOINT ["node", "index.js"]
