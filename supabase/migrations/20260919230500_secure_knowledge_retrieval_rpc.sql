alter function public.retrieve_knowledge(text, text, text[], integer) security invoker;
revoke execute on function public.retrieve_knowledge(text, text, text[], integer) from public, anon;
grant execute on function public.retrieve_knowledge(text, text, text[], integer) to authenticated;
