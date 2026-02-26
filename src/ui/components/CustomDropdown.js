/**
 * CustomDropdown.js — Portal-based custom select component
 * @module ui/components/CustomDropdown
 *
 * The options list is rendered as a direct child of <body> (portal pattern)
 * to avoid stacking context issues with sibling form elements.
 */

/**
 * Render a custom dropdown into a parent element.
 * @param {HTMLElement} parent - The parent element to mount the trigger
 * @param {Object} params
 * @param {string[]} params.options - List of string options
 * @param {string} params.initialValue - Initially selected value
 * @param {Function} params.onChange - Callback when value changes
 * @returns {{ getValue: () => string, setValue: (val: string) => void }}
 */
export function renderCustomDropdown(parent, { options, initialValue, onChange }) {
    let currentValue = initialValue || options[0] || '';
    let isOpen = false;

    // --- Trigger (stays inside the form-group) ---
    const trigger = document.createElement('div');
    trigger.className = 'custom-dropdown__trigger';
    trigger.textContent = currentValue;
    parent.appendChild(trigger);

    // --- Options list (portal: direct child of body) ---
    const optionsList = document.createElement('div');
    optionsList.className = 'custom-dropdown__options';
    document.body.appendChild(optionsList);

    function positionOptions() {
        const rect = trigger.getBoundingClientRect();
        const listHeight = optionsList.offsetHeight || (options.length * 40); // estimate if not yet rendered
        const windowHeight = window.innerHeight;

        // Horizontal
        optionsList.style.left = `${rect.left}px`;
        optionsList.style.width = `${rect.width}px`;

        // Vertical boundary check
        const spaceBelow = windowHeight - rect.bottom;
        const needsFlip = spaceBelow < listHeight + 10; // 10px buffer

        if (needsFlip) {
            optionsList.style.top = 'auto';
            optionsList.style.bottom = `${windowHeight - rect.top + 3}px`;
            optionsList.classList.add('custom-dropdown__options--flipped');
        } else {
            optionsList.style.top = `${rect.bottom + 3}px`;
            optionsList.style.bottom = 'auto';
            optionsList.classList.remove('custom-dropdown__options--flipped');
        }
    }

    function buildOptions() {
        optionsList.innerHTML = '';
        options.forEach(opt => {
            const optionEl = document.createElement('div');
            optionEl.className = 'custom-dropdown__option';
            if (opt === currentValue) optionEl.classList.add('custom-dropdown__option--selected');
            optionEl.textContent = opt;
            optionEl.addEventListener('mousedown', (e) => {
                // Use mousedown instead of click to fire before blur/close logic
                e.preventDefault();
                e.stopPropagation();
                selectValue(opt);
                closeDropdown();
            });
            optionsList.appendChild(optionEl);
        });
    }

    function selectValue(val) {
        currentValue = val;
        trigger.textContent = val;
        buildOptions();
        if (onChange) onChange(val);
    }

    function openDropdown() {
        if (isOpen) return;
        isOpen = true;
        buildOptions();
        positionOptions();
        optionsList.classList.add('custom-dropdown__options--open');
        trigger.classList.add('custom-dropdown__trigger--open');

        // Close on any click outside the options list
        setTimeout(() => {
            document.addEventListener('mousedown', onOutsideClick);
            window.addEventListener('scroll', closeDropdown, { passive: true });
            window.addEventListener('resize', closeDropdown);
        }, 10);
    }

    function closeDropdown() {
        console.log('close!!!', isOpen)
        if (!isOpen) return;
        isOpen = false;
        optionsList.classList.remove('custom-dropdown__options--open');
        trigger.classList.remove('custom-dropdown__trigger--open');
        document.removeEventListener('mousedown', onOutsideClick);
        window.removeEventListener('scroll', closeDropdown);
        window.removeEventListener('resize', closeDropdown);
    }

    function onOutsideClick(e) {
        if (!optionsList.contains(e.target) && e.target !== trigger) {
            closeDropdown();
        }
    }

    trigger.addEventListener('click', () => {
        if (isOpen) closeDropdown();
        else openDropdown();
    });

    // Cleanup when the trigger is removed from DOM
    const observer = new MutationObserver(() => {
        if (!document.body.contains(trigger)) {
            closeDropdown();
            document.body.removeChild(optionsList);
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return {
        getValue: () => currentValue,
        setValue: (val) => selectValue(val),
    };
}
