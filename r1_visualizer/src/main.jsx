import { render } from 'preact'
import { App } from './App.jsx'
import './styles.css'

// Public mount API. WordPress shortcode renders a <div data-r1-viewer ...>
// and this hydrates it; the standalone index.html calls it directly.
export function mountR1Viewer(el, options = {}) {
  const target = typeof el === 'string' ? document.querySelector(el) : el
  if (!target) throw new Error('mountR1Viewer: target element not found')
  render(<App options={options} />, target)
  return target
}

// Expose globally for non-module embeds (WordPress enqueue).
if (typeof window !== 'undefined') {
  window.mountR1Viewer = mountR1Viewer

  // Auto-mount any element carrying data-r1-viewer (lets a shortcode emit just
  // markup without inline script).
  const auto = () => {
    document.querySelectorAll('[data-r1-viewer]').forEach((node) => {
      if (node.__r1Mounted) return
      node.__r1Mounted = true
      mountR1Viewer(node, {
        dataBase: node.getAttribute('data-base') || undefined,
        reviewFindingsBase: node.getAttribute('data-findings-base') || undefined,
        carrier: node.getAttribute('data-carrier') || undefined,
        year: node.getAttribute('data-year') || undefined,
        version: node.getAttribute('data-version') || undefined,
      })
    })
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', auto)
  } else {
    auto()
  }
}
