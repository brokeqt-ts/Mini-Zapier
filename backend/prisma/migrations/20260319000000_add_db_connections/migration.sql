CREATE TABLE IF NOT EXISTS "db_connections" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "connection_string" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "db_connections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "db_connections_user_id_idx" ON "db_connections"("user_id");

ALTER TABLE "db_connections" DROP CONSTRAINT IF EXISTS "db_connections_user_id_fkey";
ALTER TABLE "db_connections" ADD CONSTRAINT "db_connections_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
