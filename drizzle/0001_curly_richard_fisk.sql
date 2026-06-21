CREATE TABLE "memory_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "memory_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "category_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_category_id_memory_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."memory_categories"("id") ON DELETE no action ON UPDATE no action;