-- AlterTable: add SMTP fields to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "smtp_host" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "smtp_port" INTEGER;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "smtp_user" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "smtp_pass" TEXT;

-- CreateTable: email_accounts
CREATE TABLE IF NOT EXISTS "email_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "smtp_host" TEXT NOT NULL,
    "smtp_port" INTEGER NOT NULL DEFAULT 465,
    "smtp_user" TEXT NOT NULL,
    "smtp_pass" TEXT NOT NULL,
    "imap_host" TEXT,
    "imap_port" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_accounts_user_id_idx" ON "email_accounts"("user_id");

-- AddForeignKey
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
