terraform {
  required_version = ">= 1.7"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # Uncomment to use GCS as a remote backend (recommended for teams)
  # backend "gcs" {
  #   bucket = "<YOUR_TFSTATE_BUCKET>"
  #   prefix = "ai-chatbot/state"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ── GCS Bucket ──────────────────────────────────────────────────────────────
resource "google_storage_bucket" "uploads" {
  name                        = "${var.project_id}-chatbot-uploads"
  location                    = var.region
  uniform_bucket_level_access = true # Enforce UBL; no per-object ACLs
  public_access_prevention    = "enforced"

  lifecycle_rule {
    condition { age = 30 }
    action { type = "Delete" }
  }

  cors {
    origin          = var.allowed_origins
    method          = ["PUT"] # Only signed-URL uploads
    response_header = ["Content-Type", "x-goog-content-length-range"]
    max_age_seconds = 3600
  }
}

# ── Service Account: Cloud Run app ──────────────────────────────────────────
resource "google_service_account" "chatbot_sa" {
  account_id   = "chatbot-sa"
  display_name = "AI Chatbot — Cloud Run Service Account"
}

resource "google_project_iam_member" "chatbot_vertex" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.chatbot_sa.email}"
}

resource "google_project_iam_member" "chatbot_secrets" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.chatbot_sa.email}"
}

resource "google_storage_bucket_iam_member" "chatbot_storage" {
  bucket = google_storage_bucket.uploads.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.chatbot_sa.email}"
}

# ── Workload Identity Federation (GitHub Actions → GCP) ────────────────────
resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github-pool"
  display_name              = "GitHub Actions Pool"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub OIDC Provider"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }

  # Restrict to your GitHub org/repo
  attribute_condition = "attribute.repository == \"${var.github_repo}\""
}

# ── Service Account: GitHub Actions deploy SA ───────────────────────────────
resource "google_service_account" "deploy_sa" {
  account_id   = "deploy-sa"
  display_name = "GitHub Actions Deploy Service Account"
}

resource "google_service_account_iam_member" "wif_deploy_binding" {
  service_account_id = google_service_account.deploy_sa.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repo}"
}

resource "google_project_iam_member" "deploy_sa_run" {
  project = var.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.deploy_sa.email}"
}

resource "google_project_iam_member" "deploy_sa_ar" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.deploy_sa.email}"
}

resource "google_project_iam_member" "deploy_sa_iam" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.deploy_sa.email}"
}

# ── Artifact Registry ────────────────────────────────────────────────────────
resource "google_artifact_registry_repository" "app_images" {
  repository_id = "app-images"
  format        = "DOCKER"
  location      = var.region
  description   = "AI Chatbot container images"
}

# ── Secret Manager placeholders ──────────────────────────────────────────────
locals {
  secrets = ["VERTEX_AI_PROJECT", "GCS_BUCKET_NAME", "FIREBASE_PROJECT_ID", "ALLOWED_ORIGINS"]
}

resource "google_secret_manager_secret" "app_secrets" {
  for_each  = toset(local.secrets)
  secret_id = each.key

  replication {
    auto {}
  }
}
