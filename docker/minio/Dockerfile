# MinIO n'est plus publié sur Docker Hub : on le compile depuis le code source officiel.
# Version figée (dernière avec la console d'administration complète).
FROM golang:1.24-alpine AS build
ARG MINIO_RELEASE=RELEASE.2025-04-22T22-12-26Z
RUN apk add --no-cache git \
 && CGO_ENABLED=0 GOBIN=/out go install -trimpath -ldflags "-s -w" github.com/minio/minio@${MINIO_RELEASE}

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=build /out/minio /usr/bin/minio
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
