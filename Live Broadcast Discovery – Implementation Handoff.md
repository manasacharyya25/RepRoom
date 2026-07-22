# Live Broadcast Discovery – Implementation Handoff

## Objective

Implement the live discovery system that powers the browse experience.

The system should:

* Create a record whenever a broadcaster goes live.
* Allow viewers to query active broadcasters page-by-page.
* Avoid continuous polling.
* Only re-query when a visible live stream has ended.

---

# R2 Folder Structure

Every broadcast should have its own folder.

```text
{room_name}/
    {user_id}/
        {session_id}/
            chunk_000001.webm
            chunk_000002.webm
            chunk_000003.webm
            ...
```

Example:

```text
strength-training/
    user_42/
        097d14e8-b12d-47d5-95fb-f7753a6a4978/
            chunk_000001.webm
            chunk_000002.webm
            chunk_000003.webm
```

The `session_id` uniquely identifies one live broadcast.

---

# live_sessions Table

This table contains **only active broadcasts**.

Suggested fields:

```text
session_id
user_id
room_name
r2_folder

started_at

last_chunk_number
last_chunk_uploaded_at

created_at
updated_at
```

The `r2_folder` should point to:

```text
{room_name}/{user_id}/{session_id}/
```

---

# Creating a Live Session

When a broadcaster starts streaming:

1. Generate a new `session_id`.
2. Create the R2 folder path.
3. Insert a row into `live_sessions`.

Example values:

```text
session_id = 097d14e8-b12d-47d5-95fb-f7753a6a4978

user_id = user_42

room_name = strength-training

r2_folder =
strength-training/user_42/097d14e8-b12d-47d5-95fb-f7753a6a4978/

started_at = now()

last_chunk_number = 0

last_chunk_uploaded_at = now()
```

After each chunk upload:

* Increment `last_chunk_number`.
* Update `last_chunk_uploaded_at`.

The chunk upload itself acts as the heartbeat. No separate heartbeat mechanism is required.

---

# Querying Live Broadcasters

The client should request broadcasters in pages of **11 users**.

Example:

```text
Page 1

LIMIT 11
```

```text
Page 2

Next 11
```

```text
Page 3

Next 11
```

Use **cursor pagination** instead of OFFSET.

Only sessions that are currently active should be returned.

The response for each broadcaster should include enough information to begin playback immediately:

```text
session_id

user_id

room_name

r2_folder

last_chunk_number

started_at
```

---

# Client Behaviour

When the application opens:

1. Request the first page of live broadcasters.
2. Render the 11 returned tiles.
3. Begin playback directly from R2.

No background polling should occur while the streams are healthy.

---

# Re-query Strategy

The client **must not** refresh the live list every few seconds.

Instead:

* Continue playing the assigned stream.
* Detect when playback can no longer continue (for example, no new chunk arrives within the configured timeout).
* Mark only that tile as inactive.
* Request **one replacement broadcaster** from the live discovery API.
* Replace the dead tile without affecting the remaining tiles.

This keeps database traffic extremely low because requests occur only:

* when the user first opens the app,
* when the user changes pages,
* or when an individual live stream has ended.

The remaining live tiles continue playing without triggering any additional database queries.
