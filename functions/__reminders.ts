// PUT and DELETE /__reminders: the app's birthday reminder schedule (see server/reminders.ts).
// The middleware runs first, so only a signed-in session gets here.
import { handleReminders, type RemindersEnv } from '../server/reminders.ts'

export const onRequest: PagesFunction<RemindersEnv> = (context) =>
  handleReminders(context.request, context.env, Date.now())
