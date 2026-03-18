
variable "name" {
  type        = string
}

resource "null_resource" "example" {
  triggers = {
    name = var.name
  }
}
