# terraform/main.tf
terraform {
  required_providers {
    render = {
      source = "render-oss/render"
      version = "1.0.0" # Example version
    }
  }
}

variable "render_api_key" {
  type = string
  sensitive = true
}

variable "supabase_url" {
  type = string
}

variable "telegram_api_id" {
  type = string
}

provider "render" {
  api_key = var.render_api_key
}

resource "render_web_service" "backend" {
  name               = "nexusedu-api"
  runtime            = "docker"
  plan               = "starter"
  region             = "singapore"
  # This points to the repo where backend code resides
  # branch             = "main"
  
  env_vars = {
    "SUPABASE_URL"     = { value = var.supabase_url }
    "TELEGRAM_API_ID"  = { value = var.telegram_api_id }
  }
}

resource "render_redis" "cache" {
  name   = "nexusedu-cache"
  plan   = "free"
  region = "singapore"
}
