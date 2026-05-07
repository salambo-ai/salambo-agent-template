FROM node:24-bookworm-slim

WORKDIR /workspace

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates curl git python3 \
  && rm -rf /var/lib/apt/lists/*

COPY workspace/ /workspace/
COPY tools/ /workspace/tools/

CMD ["sleep", "infinity"]
