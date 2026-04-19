-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_client_id_business_id_key" ON "Favorite"("client_id", "business_id");

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
