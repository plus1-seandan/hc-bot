FROM node:lts

WORKDIR /app

RUN npm install -g @anthropic-ai/claude-code

ENV DISCORD_TOKEN=""
ENV ANTHROPIC_API_KEY=""

CMD ["claude", "--channels", "plugin:discord@claude-plugins-official"]
