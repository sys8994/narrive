/**
 * BrandIcon.js — Reusable PNG brand icon for Arcweaver.
 */

export function getBrandIconHtml({ size = 24, className = '' } = {}) {
    return `<img
      src="assets/logo.png"
      width="${size}"
      height="${size}"
      alt=""
      aria-hidden="true"
      class="brand-icon ${className}"
      style="display: inline-block; vertical-align: middle;"
    />`;
}
