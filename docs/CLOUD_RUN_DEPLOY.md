# Cloud Run Deployment (API + Worker Job)

Last updated: 2026-02-22

This deploys:

1. API as Cloud Run Service (`curra-api`)
2. Disbursement worker as Cloud Run Job (`curra-disbursement-worker`)

## 1) Set project and region

```bash
export PROJECT_ID="<your-gcp-project-id>"
export REGION="us-central1"
```

## 2) Enable required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  --project "$PROJECT_ID"
```

## 3) Create Artifact Registry repo

```bash
gcloud artifacts repositories create curra \
  --repository-format=docker \
  --location="$REGION" \
  --project="$PROJECT_ID"
```

## 4) Create/update secrets

```bash
printf '%s' '<postgres-connection-string>' | gcloud secrets create DATABASE_URL --data-file=- --replication-policy=automatic --project "$PROJECT_ID" || true
printf '%s' '<postgres-connection-string>' | gcloud secrets versions add DATABASE_URL --data-file=- --project "$PROJECT_ID"

printf '%s' '<eversend-client-id>' | gcloud secrets create EVERSEND_CLIENT_ID --data-file=- --replication-policy=automatic --project "$PROJECT_ID" || true
printf '%s' '<eversend-client-id>' | gcloud secrets versions add EVERSEND_CLIENT_ID --data-file=- --project "$PROJECT_ID"

printf '%s' '<eversend-client-secret>' | gcloud secrets create EVERSEND_CLIENT_SECRET --data-file=- --replication-policy=automatic --project "$PROJECT_ID" || true
printf '%s' '<eversend-client-secret>' | gcloud secrets versions add EVERSEND_CLIENT_SECRET --data-file=- --project "$PROJECT_ID"

printf '%s' '<eversend-webhook-secret>' | gcloud secrets create EVERSEND_WEBHOOK_SECRET --data-file=- --replication-policy=automatic --project "$PROJECT_ID" || true
printf '%s' '<eversend-webhook-secret>' | gcloud secrets versions add EVERSEND_WEBHOOK_SECRET --data-file=- --project "$PROJECT_ID"
```

## 5) Grant runtime service account access to secrets

```bash
export RUNTIME_SA="${PROJECT_ID}-compute@developer.gserviceaccount.com"

for secret in DATABASE_URL EVERSEND_CLIENT_ID EVERSEND_CLIENT_SECRET EVERSEND_WEBHOOK_SECRET; do
  gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --project "$PROJECT_ID"
done
```

## 6) Run Cloud Build deploy

```bash
gcloud builds submit \
  --config deploy/cloudbuild.yaml \
  --substitutions=_REGION="$REGION" \
  --project "$PROJECT_ID"
```

## 7) Run DB migrations from local against production DB

Use the same `DATABASE_URL` secret value locally and run:

```bash
export DATABASE_URL='<postgres-connection-string>'
pnpm --filter @curra/curra-api migrate
```

## 8) Map API domain

Map `api.curra.ai` to `curra-api` service in Cloud Run, then set DNS records.

After mapping, webhook URL is:

```text
https://api.curra.ai/webhooks/eversend
```

## 9) Schedule worker job (every minute)

Create a scheduler service account:

```bash
gcloud iam service-accounts create curra-scheduler \
  --display-name="Curra Scheduler" \
  --project "$PROJECT_ID"
```

Grant it run job invoker:

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:curra-scheduler@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

Create scheduler job:

```bash
gcloud scheduler jobs create http curra-disbursement-run \
  --project "$PROJECT_ID" \
  --location "$REGION" \
  --schedule "* * * * *" \
  --uri "https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/curra-disbursement-worker:run" \
  --http-method POST \
  --oauth-service-account-email "curra-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"
```

## 10) Post-deploy checks

1. `GET /health` returns 200 from `api.curra.ai`.
2. Trigger payroll finalize and verify outbox rows are created.
3. Verify `event_consumption_log` transitions to `succeeded` for disbursement events.
4. Verify Eversend callback hits `POST /webhooks/eversend` with valid signature.
