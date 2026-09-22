# DigitalOcean production

## Resources

- Project: `Bran` (`4a3ef721-352e-41de-8ecd-fe1d1d902429`)
- Region/VPC: Bangalore / `bran-production-vpc` (`b88dd0a4-9f08-46d1-b097-f265b584aa11`)
- App Platform: `bran-be` (`d1253564-720b-49ab-991b-540c2b222881`)
- Application URL: `https://bran-be-6jtht.ondigitalocean.app`
- PostgreSQL: `bran-postgres`, PostgreSQL 18 (`096f9931-f367-4bf8-aa83-450d24cc055a`)
- Qdrant: `bran-qdrant`, private address `10.124.0.4:6333`
- Qdrant volume: `bran-qdrant-data` (`bbb78ab4-b67a-11f1-9b78-6e71a83ac88c`)
- Spaces bucket: `bran-production-sgp1` (Singapore is the closest Spaces region currently available)

Production credentials are stored outside the repository in
`~/.config/bran-be/digitalocean-production.env` with mode `0600`.

## Deployment

The account's Basic Container Registry is at its five-repository limit. Until the registry is
upgraded, Bran images use isolated `bran-<git-sha>` tags in the existing
`dfi-carousel-backend` repository. Existing tags are not overwritten.

```bash
TAG="$(git rev-parse --short=12 HEAD)"
doctl registry login --expiry-seconds 3600
docker build --platform linux/amd64 \
  -t "registry.digitalocean.com/mu-pitch-studio/dfi-carousel-backend:bran-$TAG" .
docker push "registry.digitalocean.com/mu-pitch-studio/dfi-carousel-backend:bran-$TAG"

node scripts/digitalocean/render-app-spec.mjs \
  --use-do-qdrant \
  --app-url https://bran-be-6jtht.ondigitalocean.app
doctl apps update d1253564-720b-49ab-991b-540c2b222881 \
  --spec /tmp/bran-app-spec.json \
  --wait
```

Use `--disable-schedulers` while Railway is still active. Never run both deployments with
in-process schedulers enabled.

## External callback URLs

- Slack events: `https://bran-be-6jtht.ondigitalocean.app/api/slack/events`
- Slack commands: `https://bran-be-6jtht.ondigitalocean.app/api/slack/commands`
- Slack interactions: `https://bran-be-6jtht.ondigitalocean.app/api/slack/interactions`
- Recall webhook: `https://bran-be-6jtht.ondigitalocean.app/webhooks/recall`
- Google Calendar OAuth: `https://bran-be-6jtht.ondigitalocean.app/oauth/google/calendar/callback`
- Google Gmail OAuth: `https://bran-be-6jtht.ondigitalocean.app/oauth/google/gmail/callback`

## Qdrant administration

Qdrant listens on port 6333, restricted by the DigitalOcean Cloud Firewall and UFW to the Bran
VPC. Its API key is generated on the Droplet at `/etc/bran-qdrant.env`. Data is mounted at
`/mnt/bran-qdrant/storage`.

```bash
ssh -i ~/.ssh/pitch_studio_do root@159.89.174.255
cd /opt/bran-qdrant
docker compose ps
docker compose logs --tail=100
```

## Verification

```bash
curl -fsS https://bran-be-6jtht.ondigitalocean.app/
curl -fsS https://bran-be-6jtht.ondigitalocean.app/en/v1/health
doctl apps logs d1253564-720b-49ab-991b-540c2b222881 api --type run --tail 100
```
