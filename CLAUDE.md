# AI Chatbot — Project State

## Stack
- **Frontend:** React + Vite + TypeScript + Tailwind CSS (`/client`)
- **Backend:** Node.js + TypeScript + Express (`/server`)
- **AI:** Vertex AI (Gemini 2.0 Flash) via `@google-cloud/vertexai`
- **Storage:** GCS with V4 signed URLs (Uniform Bucket-Level Access)
- **Auth:** Firebase Auth / Google Identity Platform (middleware stub in place)
- **Infra:** Cloud Run (single container), Terraform in `/terraform`
- **CI/CD:** GitHub Actions with Workload Identity Federation

## GCP Resources (to be provisioned)
| Resource | Name |
|---|---|
| Project | `<YOUR_GCP_PROJECT_ID>` |
| Region | `us-central1` |
| Cloud Run service | `ai-chatbot` |
| GCS Bucket | `<PROJECT_ID>-chatbot-uploads` |
| Service Account | `chatbot-sa@<PROJECT_ID>.iam.gserviceaccount.com` |
| WIF Pool | `github-pool` |
| WIF Provider | `github-provider` |

## Environment Variables (set via Secret Manager on Cloud Run)
- `VERTEX_AI_PROJECT` — GCP project ID
- `VERTEX_AI_LOCATION` — e.g. `us-central1`
- `GCS_BUCKET_NAME` — upload bucket name
- `FIREBASE_PROJECT_ID` — Firebase project
- `ALLOWED_ORIGINS` — comma-separated list of allowed CORS origins

## Key Architectural Decisions
- No service account key files — WIF only for CI/CD.
- GCS files never public; always via signed URLs (15 min TTL).
- All LLM inputs validated with Zod before reaching AI services.
- Skills are auto-loaded by `ChatAgent` from `/src/skills/*.ts`.
- Structured JSON logging via `pino` → Cloud Logging.
- OpenTelemetry trace spans on all AI and storage calls.

## Development
```bash
# Run both frontend and backend
npm run dev

# Backend only (port 8080)
npm run dev --workspace=server

# Frontend only (port 5173)
npm run dev --workspace=client
```
