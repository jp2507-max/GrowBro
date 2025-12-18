-- Enable pgcrypto in public schema for UUID generation and hashing helpers
create extension if not exists "pgcrypto" with schema public;
