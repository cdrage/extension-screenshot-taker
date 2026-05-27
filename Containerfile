FROM scratch as builder
COPY dist/ /extension/dist
COPY package.json /extension/
COPY LICENSE /extension/
COPY icon.png /extension/

FROM scratch

LABEL org.opencontainers.image.title="Screenshot Themes" \
        org.opencontainers.image.description="Capture Podman Desktop screenshots in all color themes" \
        org.opencontainers.image.vendor="cdrage" \
        io.podman-desktop.api.version=">= 1.10.0"

COPY --from=builder /extension /extension