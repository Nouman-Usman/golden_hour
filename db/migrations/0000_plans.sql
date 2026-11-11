CREATE TYPE "public"."plan_period" AS ENUM('one_time', 'month', 'quarter', 'year');--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"period" "plan_period" DEFAULT 'month' NOT NULL,
	"description" text,
	"features" text[] DEFAULT '{}'::text[] NOT NULL,
	"highlighted" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_price_non_negative" CHECK ("plans"."price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;