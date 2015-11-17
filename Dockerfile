FROM node:4.2.2
COPY package.json /src/package.json
RUN cd /src; npm install
COPY . /src
CMD ["node", "src/index.js"]
