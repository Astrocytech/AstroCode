
terraform {
  backend "remote" {
    name        = "my-terraform-state"
    organization = "MyOrganization"

    workspaces {
      name         = "dev"
    }
  }
}
