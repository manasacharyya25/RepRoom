-- Speed ended-session archive fill queries for discovery tiles.
create index if not exists live_sessions_room_ended_idx
  on public.live_sessions (room_id, ended_at desc nulls last, last_chunk_uploaded_at desc)
  where (status = 'ended' and last_chunk_number > 0);
