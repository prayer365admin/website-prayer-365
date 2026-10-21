CREATE TABLE "auth_login_attempt" (
    "user_id" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "window_started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blocked_until" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_login_attempt_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "auth_login_attempt"
ADD CONSTRAINT "auth_login_attempt_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
