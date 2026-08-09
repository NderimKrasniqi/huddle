# Convex backend

Huddle uses Convex for its public room, roster, presence, and game functions.

Before editing backend code, read the generated Convex guidance at
`convex/_generated/ai/guidelines.md` when it is present. Keep public function
paths stable, put shared implementation helpers under `convex/lib/`, and never
commit deployment credentials or production cleanup commands.
