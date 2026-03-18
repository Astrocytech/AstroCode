
resource "aws_instance" "example" {
  ami           = "ami-abcd1234"
  instance_type = var.instance_type
}
