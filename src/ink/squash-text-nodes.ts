import type { DOMElement } from './dom.js'
import type { TextStyles } from './styles.js'

/**
 * A segment of text with its associated styles.
 * Used for structured rendering without ANSI string transforms.
 */
export type StyledSegment = {
  text: string
  styles: TextStyles
  hyperlink?: string
}

/**
 * Squash text nodes into styled segments, propagating styles down through the tree.
 * This allows structured styling without relying on ANSI string transforms.
 */
const MAX_RECURSION_DEPTH = 64

export function squashTextNodesToSegments(
  node: DOMElement,
  inheritedStyles: TextStyles = {},
  inheritedHyperlink?: string,
  out: StyledSegment[] = [],
  depth: number = 0,
): StyledSegment[] {
  if (depth > MAX_RECURSION_DEPTH) return out
  const mergedStyles = node.textStyles
    ? { ...inheritedStyles, ...node.textStyles }
    : inheritedStyles

  for (const childNode of node.childNodes) {
    if (childNode === undefined) {
      continue
    }

    if (childNode.nodeName === '#text') {
      if (childNode.nodeValue.length > 0) {
        out.push({
          text: childNode.nodeValue,
          styles: mergedStyles,
          hyperlink: inheritedHyperlink,
        })
      }
    } else if (
      childNode.nodeName === 'ink-text' ||
      childNode.nodeName === 'ink-virtual-text'
    ) {
      squashTextNodesToSegments(
        childNode,
        mergedStyles,
        inheritedHyperlink,
        out,
        depth + 1,
      )
    } else if (childNode.nodeName === 'ink-link') {
      const href = childNode.attributes['href'] as string | undefined
      squashTextNodesToSegments(
        childNode,
        mergedStyles,
        href || inheritedHyperlink,
        out,
        depth + 1,
      )
    }
  }

  return out
}

/**
 * Squash text nodes into a plain string (without styles).
 * Used for text measurement in layout calculations.
 */
function squashTextNodes(node: DOMElement, depth: number = 0): string {
  if (depth > MAX_RECURSION_DEPTH) return ''
  let text = ''

  for (const childNode of node.childNodes) {
    if (childNode === undefined) {
      continue
    }

    if (childNode.nodeName === '#text') {
      text += childNode.nodeValue
    } else if (
      childNode.nodeName === 'ink-text' ||
      childNode.nodeName === 'ink-virtual-text'
    ) {
      text += squashTextNodes(childNode, depth + 1)
    } else if (childNode.nodeName === 'ink-link') {
      text += squashTextNodes(childNode, depth + 1)
    }
  }

  return text
}

export default squashTextNodes
