resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.prefix}-redis-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = { Name = "${local.prefix}-redis-subnet-group" }
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${local.prefix}-redis"
  description           = "Redis for ${local.prefix} (BullMQ export queue + ticket email queue)"

  node_type            = var.redis_node_type
  num_cache_clusters   = 1
  engine_version       = "7.1"
  parameter_group_name = "default.redis7"
  port                 = 6379

  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.redis.id]
  automatic_failover_enabled = false

  tags = { Name = "${local.prefix}-redis" }
}
