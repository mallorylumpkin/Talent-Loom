-- =====================================================================
-- TalentLoom · 1400 · More platforms
--  - Facebook Pages can be connected (official Graph API, verified numbers)
--  - Shopping / affiliate platforms creators can list: Amazon storefront,
--    LTK, ShopMy. None of them offers an API that lets a third party read a
--    creator's audience or earnings, so they're added manually and their
--    numbers are self-reported (or reviewed by staff from screenshots).
-- =====================================================================

alter table public.social_connections drop constraint social_connections_provider_check;
alter table public.social_connections
  add constraint social_connections_provider_check check (provider in ('instagram', 'tiktok', 'youtube', 'facebook'));

update public.platforms set api_supported = true where key = 'facebook';

insert into public.platforms (key, label, icon, profile_url_template, api_supported, sort) values
  ('amazon', 'Amazon Storefront', 'shopping-bag', 'https://www.amazon.com/shop/{handle}', false, 110),
  ('ltk',    'LTK',               'shopping-bag', 'https://www.shopltk.com/explore/{handle}', false, 120),
  ('shopmy', 'ShopMy',            'shopping-bag', 'https://shopmy.us/{handle}', false, 130)
on conflict (key) do nothing;

-- Keep "Other" last.
update public.platforms set sort = 999 where key = 'other';
