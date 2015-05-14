FROM    centos:centos6
RUN curl -sL https://rpm.nodesource.com/setup | bash -
RUN yum install -y nodejs
COPY package.json /src/package.json
RUN cd /src; npm install
COPY . /src
CMD ["node", "src/index.js"]
