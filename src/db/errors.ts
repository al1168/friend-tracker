/** A problem the user can fix. `message` is shown in the UI as-is. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
