FROM node:15

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

# RUN npm install -g yarn
RUN yarn install

# Bundle app source
COPY . .

EXPOSE 3000
CMD [ "./node_modules/ts-node/dist/bin.js", "src/index.ts" ]