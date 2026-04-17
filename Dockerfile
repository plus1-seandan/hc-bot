FROM node:lts

WORKDIR /app

RUN npm install -g @anthropic-ai/claude-code

# Pre-configure Claude to skip first-run theme selection
RUN mkdir -p /root/.claude && \
    printf '{"theme":"dark"}\n' > /root/.claude/settings.json

ENV DISCORD_TOKEN=""
ENV ANTHROPIC_API_KEY=""

CMD ["sh", "-c", "script -q -c 'claude --channels plugin:discord@claude-plugins-official' /dev/null"]
