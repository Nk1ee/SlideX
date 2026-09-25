# n8n education-context migration

`fsm-engine.education-context.js` is the next Code node implementation. It is intentionally separate from `legacy/n8n/fsm-engine.js`: legacy is an immutable snapshot of the working MVP.

The new dialogue starts with the presentation topic and subject. It then asks **«Где вы учитесь?»** and stores one of three stable identifiers: `school`, `college`, `university`. School asks for `school_class`; college and university ask for `course` and `student_group`. After slide count and student name, the final question shows `docs/themes/telegram-theme-choice.png` and asks for a number from 1 to 8. User-entered metadata is copied from the raw Telegram text without spelling correction.

Before switching the Code node:

1. Apply `supabase-education-context.sql` to the `user_sessions` table.
2. In the `/start` branch, create the session with state `waiting_topic`; the first message continues to ask for the presentation topic.
3. Add `education_stage`, `school_class`, `course`, and `presentation_style` to the Supabase **Update a row** node, using the same current-value fallback pattern as the existing fields.
4. Add a Telegram photo step for `replyPhotoAsset`. Map `telegram-theme-choice.png` to a configured hosted asset or binary file; do not hardcode a machine-local path in production.
5. Replace the **FSM Engine** Code node body with `fsm-engine.education-context.js`.
6. Keep the workflow inactive during import, run all three dialogue paths and all eight style numbers, and only then switch production traffic.

## Importable staging workflow

Run `npm run n8n:build` to regenerate `workflow.education-context.json` from the immutable sanitized legacy snapshot. The generated workflow is always inactive and contains credential placeholders. After import, select the existing Telegram and Supabase credentials manually and configure the Gemini API key plus renderer endpoint.

The staging workflow adds `Check Reply Photo` and `Send Theme Choice Photo`. The photo node currently uses the public GitHub raw URL for `telegram-theme-choice.png`, which was verified to return `image/png`. Before a commercial launch, move this asset to controlled storage and change the URL in the generator.

The workflow still uses the legacy Gemini schema, Parse Structure logic and Val Town renderer path. The migration only makes the new dialogue and trusted education/style metadata testable inside n8n. Do not activate it for users until the renderer endpoint supports the selected themes and an end-to-end presentation has passed QC.

The school path temporarily copies `school_class` into the existing required `group` field. The canonical renderer reads `educationContext.schoolClass`; the duplicate keeps the current wire contract migration-safe until `group` can become stage-specific in a future contract version.
