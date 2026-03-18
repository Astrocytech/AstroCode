resource "aws_security_group" "main" {
  name        = "main-sg"
  description = "Allow inbound traffic on port 22 and 80"
  vpc_id      = aws_vpc.main.id
}
