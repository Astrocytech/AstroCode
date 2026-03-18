
job "example-job" {
  datacenters = ["dc1"]
  type        = "service"

  group "example-group" {
    count = 2

    task "example-task" {
      driver = "docker"

      config {
        image     = "hashicorp/consul-server"
        port      = "8500"
      }
    }
  }
}
