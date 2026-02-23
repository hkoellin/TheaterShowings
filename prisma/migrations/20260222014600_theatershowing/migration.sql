-- CreateEnum
CREATE TYPE "PreferenceType" AS ENUM ('director', 'film', 'actor');

-- CreateTable
CREATE TABLE "Subscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Preference" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "type" "PreferenceType" NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "showtimeId" TEXT NOT NULL,
    "filmTitle" TEXT NOT NULL,
    "theater" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_email_key" ON "Subscriber"("email");

-- CreateIndex
CREATE INDEX "Preference_type_value_idx" ON "Preference"("type", "value");

-- CreateIndex
CREATE UNIQUE INDEX "Preference_subscriberId_type_value_key" ON "Preference"("subscriberId", "type", "value");

-- CreateIndex
CREATE INDEX "NotificationLog_subscriberId_sentAt_idx" ON "NotificationLog"("subscriberId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_subscriberId_showtimeId_key" ON "NotificationLog"("subscriberId", "showtimeId");

-- AddForeignKey
ALTER TABLE "Preference" ADD CONSTRAINT "Preference_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
