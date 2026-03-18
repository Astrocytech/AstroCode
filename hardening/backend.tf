
terraform {
  backend "s3" {
    bucket = "my-terraform-state"
    key    = "path/to/state/terraform.tfstate"
    region = "us-east-1"
  }
}
