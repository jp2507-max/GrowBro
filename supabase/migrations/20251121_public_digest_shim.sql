-- Expose digest from extensions schema into public for compatibility
create or replace function public.digest(data bytea, type text)
returns bytea
language sql
immutable
as $function$
  select extensions.digest(data, type);
$function$;

create or replace function public.digest(data text, type text)
returns bytea
language sql
immutable
as $function$
  select extensions.digest(convert_to(data, 'UTF8'), type);
$function$;
