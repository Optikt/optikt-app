FROM alpine:3.19

RUN apk add --no-cache \
    postgresql16-client \
    rclone \
    curl \
    bash \
    tzdata

COPY rclone.conf /etc/rclone/rclone.conf
COPY backup.sh /usr/local/bin/backup.sh
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/entrypoint.sh \
    && mkdir -p /backups /var/log /etc/rclone

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
