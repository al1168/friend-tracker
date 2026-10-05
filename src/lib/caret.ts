import type { Span } from './viewport'

/** What the mirror copies from the box, so its text wraps exactly the same way. */
const COPIED = [
  'boxSizing',
  'width',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderTopStyle',
  'borderRightStyle',
  'borderBottomStyle',
  'borderLeftStyle',
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontWeight',
  'fontStretch',
  'fontVariant',
  'lineHeight',
  'letterSpacing',
  'wordSpacing',
  'textTransform',
  'textIndent',
  'tabSize',
  'overflowWrap',
  'wordBreak',
] as const

/**
 * The screen top and bottom of the line holding the caret in a text box. A box that grows to fit its text never
 * scrolls, so the browser can't say where its caret is: this measures it with a hidden mirror copy of the box
 * (same width, font, padding, line height and wrapping) holding the text up to the caret and a marker.
 */
export function caretLineSpan(box: HTMLTextAreaElement): Span {
  const style = getComputedStyle(box)
  const mirror = document.createElement('div')
  for (const name of COPIED) mirror.style[name] = style[name]
  mirror.style.position = 'absolute'
  mirror.style.top = '0'
  mirror.style.left = '-9999px'
  mirror.style.height = 'auto'
  mirror.style.overflow = 'hidden'
  mirror.style.visibility = 'hidden'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.textContent = box.value.slice(0, box.selectionEnd)
  const marker = document.createElement('span')
  marker.textContent = '\u200b'
  mirror.append(marker)
  document.body.append(mirror)
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2
  // The marker's box sits inside its line, half the leading below the line's top.
  const top = marker.offsetTop - (lineHeight - marker.offsetHeight) / 2
  mirror.remove()
  const lineTop = box.getBoundingClientRect().top + box.clientTop + top - box.scrollTop
  return { top: lineTop, bottom: lineTop + lineHeight }
}
