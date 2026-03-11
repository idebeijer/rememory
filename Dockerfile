FROM gcr.io/distroless/static-debian12

ARG TARGETARCH
COPY dist/rememory-linux-${TARGETARCH} /rememory

EXPOSE 8080
VOLUME ["/data"]
ENTRYPOINT ["/rememory", "serve", "--host", "0.0.0.0", "--port", "8080", "--data", "/data"]
