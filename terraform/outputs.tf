output "upload_bucket_name" {
  description = "GCS upload bucket name"
  value       = google_storage_bucket.uploads.name
}

output "chatbot_service_account" {
  description = "Cloud Run service account email"
  value       = google_service_account.chatbot_sa.email
}

output "deploy_service_account" {
  description = "GitHub Actions deploy service account email"
  value       = google_service_account.deploy_sa.email
}

output "wif_provider_name" {
  description = "Workload Identity Federation provider name (use as WIF_PROVIDER in GitHub vars)"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "artifact_registry_url" {
  description = "Artifact Registry base URL for Docker images"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app_images.repository_id}"
}
