FROM --platform=linux/amd64 node:lts-alpine

EXPOSE 5000

WORKDIR /src

RUN npm install i npm@latest -g

COPY package.json package-lock*.json ./

RUN npm install

COPY . .

CMD ["node", "src/index.js"]