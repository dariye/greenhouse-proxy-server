[![CircleCI](https://circleci.com/gh/pauldariye/greenhouse-proxy-server.svg?style=svg)](https://circleci.com/gh/pauldariye/greenhouse-proxy-server)

# greenhouse-proxy-server
This is a simple proxy server for greenhouse.io

# Installation

```bash
git clone git@github.com:pauldariye/greenhouse-proxy-server.git

cd greenhouse-proxy-server

cp .env.example .env.dev # provide all env variables. Checkout https://github.com/motdotla/dotenv

yarn # or npm install

yarn run dev # go to localhost:3000
```

# Deployment

This project uses zeit.co's [now](https://zeit.co/now) platform
for deployments.

See the `now.json` file for the config.

Ensure you're in the project directory.

You can update the `alias` property in the `now.json` file if you're only testing.

```bash
cp .env.example .env # set production env variables

. ./deploy.sh # deploy and set alias
```

# License

MIT

