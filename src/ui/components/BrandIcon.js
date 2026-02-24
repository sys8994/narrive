/**
 * BrandIcon.js — Reusable SVG brand icon for Narrive
 * A minimalist design combining a pen nib and a guiding star.
 */

export function getBrandIconHtml({ size = 24, className = '' } = {}) {
    // SVG path for a stylized pen nib with a star cutout or tip
    return `
    <svg 
      width="${size}" 
      height="${size}" 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      class="brand-icon ${className}"
      style="display: inline-block; vertical-align: middle;"
    >
      <!-- Stylized Nib -->
      <path 
        d="M12 2C12 2 10 6 8 10C6 14 6 16 6 18C6 20.2091 7.79086 22 10 22H14C16.2091 22 18 20.2091 18 18C18 16 18 14 16 10C14 6 12 2 12 2Z" 
        fill="currentColor" 
        fill-opacity="0.15"
      />
      <path 
        d="M12 2L8 10C6 14 6 16 6 18C6 20 8 22 10 22L12 18L14 22C16 22 18 20 18 18C18 16 18 14 16 10L12 2Z" 
        stroke="currentColor" 
        stroke-width="1.5" 
        stroke-linejoin="round"
      />
      <!-- Connecting Line -->
      <path d="M12 18V22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      
      <!-- Central Guiding Star (Diamond) -->
      <path 
        d="M12 7L13.5 10L12 13L10.5 10L12 7Z" 
        fill="currentColor"
        class="brand-icon__star"
      />
    </svg>
  `;
}
