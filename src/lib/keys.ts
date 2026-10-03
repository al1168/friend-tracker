/** True for a plain Enter press that isn't confirming an IME composition. */
export function isPlainEnter(event: {
  key: string
  keyCode: number
  nativeEvent: { isComposing?: boolean }
}): boolean {
  return event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229
}
