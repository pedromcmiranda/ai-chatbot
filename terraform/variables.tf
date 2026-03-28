variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "Primary GCP region"
  type        = string
  default     = "us-central1"
}

variable "github_repo" {
  description = "GitHub repository in org/repo format (e.g. my-org/ai-chatbot)"
  type        = string
}

variable "allowed_origins" {
  description = "List of allowed CORS origins for the GCS bucket"
  type        = list(string)
  default     = ["https://your-app-domain.com"]
}
