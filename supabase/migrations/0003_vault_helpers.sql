-- Vault helper RPCs for credential tokens.
-- These run as SECURITY DEFINER and are intended to be called ONLY by the
-- service-role server client. We revoke execute from anon/authenticated so
-- tokens can never be read through the public API or RLS.

-- Store a new secret, returns the Vault secret id ---------------------------
create or replace function public.vault_store_secret(
  secret text,
  name text default null,
  description text default null
)
returns uuid
language plpgsql
security definer
set search_path = vault, public
as $$
declare
  new_id uuid;
begin
  new_id := vault.create_secret(secret, name, description);
  return new_id;
end;
$$;

-- Read a decrypted secret by id (server-only use) ---------------------------
create or replace function public.vault_read_secret(secret_id uuid)
returns text
language plpgsql
security definer
set search_path = vault, public
as $$
declare
  result text;
begin
  select decrypted_secret into result
  from vault.decrypted_secrets
  where id = secret_id;
  return result;
end;
$$;

-- Delete a secret by id -----------------------------------------------------
create or replace function public.vault_delete_secret(secret_id uuid)
returns void
language plpgsql
security definer
set search_path = vault, public
as $$
begin
  delete from vault.secrets where id = secret_id;
end;
$$;

-- Lock these down: only the service role (which bypasses RLS and is not the
-- anon/authenticated role) may call them. Revoke from public roles.
revoke all on function public.vault_store_secret(text, text, text) from public, anon, authenticated;
revoke all on function public.vault_read_secret(uuid) from public, anon, authenticated;
revoke all on function public.vault_delete_secret(uuid) from public, anon, authenticated;
