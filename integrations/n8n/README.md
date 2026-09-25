# n8n education-context migration

`fsm-engine.education-context.js` is the next Code node implementation. It is intentionally separate from `legacy/n8n/fsm-engine.js`: legacy is an immutable snapshot of the working MVP.

The new dialogue starts with **«Где вы учитесь?»** and stores one of three stable identifiers: `school`, `college`, `university`. School asks for `school_class`; college and university ask for `course` and `student_group`. User-entered metadata is copied from the raw Telegram text without spelling correction.

Before switching the Code node:

1. Apply `supabase-education-context.sql` to the `user_sessions` table.
2. In the `/start` branch, create the session with state `waiting_education_stage`.
3. Change the first Telegram message to «Где вы учитесь?» and show buttons «Школа», «Колледж», «Вуз».
4. Add `education_stage`, `school_class`, and `course` to the Supabase **Update a row** node, using the same current-value fallback pattern as the existing fields.
5. Replace the **FSM Engine** Code node body with `fsm-engine.education-context.js`.
6. Keep the workflow inactive during import, run all three dialogue paths, and only then switch production traffic.

The school path temporarily copies `school_class` into the existing required `group` field. The canonical renderer reads `educationContext.schoolClass`; the duplicate keeps the current wire contract migration-safe until `group` can become stage-specific in a future contract version.
