-- Add permission columns to menus table
-- Defaulting to true so existing menus don't disappear immediately
ALTER TABLE public.menus 
ADD COLUMN IF NOT EXISTS "allowDistributor" boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS "allowMarket" boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS "allowLocal" boolean DEFAULT true;

-- Force update to ensure existing rows have true
UPDATE public.menus SET "allowDistributor" = true WHERE "allowDistributor" IS NULL;
UPDATE public.menus SET "allowMarket" = true WHERE "allowMarket" IS NULL;
UPDATE public.menus SET "allowLocal" = true WHERE "allowLocal" IS NULL;