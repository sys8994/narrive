/**
 * FormRenderer.js — Dynamic form renderer from JSON schema
 * @module ui/components/FormRenderer
 *
 * Takes a questions array from Prompt #1 output and generates DOM form elements.
 * Supports: text, textarea, select, slider, checkbox
 */

/**
 * Render a dynamic form into a container.
 * @param {HTMLElement} container
 * @param {Array} questions — from Prompt #1 schema
 * @returns {{ getValues: () => Object }}
 */
export function renderForm(container, questions) {
    container.innerHTML = '';

    const fieldEls = {};

    questions.forEach((q) => {
        const group = document.createElement('div');
        group.className = 'form-group reveal-item';
        // Add staggered delay based on index
        const index = questions.indexOf(q);
        group.style.animationDelay = `${index * 0.08}s`;

        const label = document.createElement('label');
        label.className = 'label';
        label.textContent = q.label;
        label.setAttribute('for', `form-${q.id}`);
        group.appendChild(label);

        let inputEl;
        let customInputEl = null;

        switch (q.type) {
            case 'select': {
                inputEl = document.createElement('select');
                inputEl.className = 'select';
                inputEl.id = `form-${q.id}`;

                customInputEl = document.createElement('input');
                customInputEl.type = 'text';
                customInputEl.className = 'input';
                customInputEl.style.display = 'none';
                customInputEl.style.marginTop = '8px';
                customInputEl.placeholder = '직접 입력해주세요...';

                (q.options || []).forEach((opt) => {
                    const option = document.createElement('option');
                    option.value = opt;
                    option.textContent = opt;
                    inputEl.appendChild(option);
                });

                inputEl.addEventListener('change', (e) => {
                    if (e.target.value === '기타(직접 입력)') {
                        customInputEl.style.display = 'block';
                        customInputEl.focus();
                    } else {
                        customInputEl.style.display = 'none';
                    }
                });

                group.appendChild(inputEl);
                group.appendChild(customInputEl);
                break;
            }

            case 'textarea': {
                inputEl = document.createElement('textarea');
                inputEl.className = 'textarea';
                inputEl.id = `form-${q.id}`;
                inputEl.placeholder = q.placeholder || '';
                inputEl.rows = 3;
                group.appendChild(inputEl);
                break;
            }

            case 'slider': {
                const wrap = document.createElement('div');
                wrap.className = 'slider-wrap';
                inputEl = document.createElement('input');
                inputEl.type = 'range';
                inputEl.className = 'slider';
                inputEl.id = `form-${q.id}`;
                inputEl.min = q.min ?? 0;
                inputEl.max = q.max ?? 10;
                inputEl.value = Math.round(((q.min ?? 0) + (q.max ?? 10)) / 2);
                const valSpan = document.createElement('span');
                valSpan.className = 'slider-value';
                valSpan.textContent = inputEl.value;
                inputEl.addEventListener('input', () => { valSpan.textContent = inputEl.value; });
                wrap.appendChild(inputEl);
                wrap.appendChild(valSpan);
                group.appendChild(wrap);
                break;
            }

            case 'checkbox': {
                const wrap = document.createElement('label');
                wrap.className = 'checkbox-wrap';
                inputEl = document.createElement('input');
                inputEl.type = 'checkbox';
                inputEl.id = `form-${q.id}`;
                const span = document.createElement('span');
                span.textContent = q.label;
                wrap.appendChild(inputEl);
                wrap.appendChild(span);
                // Replace label with wrap
                group.removeChild(label);
                group.appendChild(wrap);
                break;
            }

            case 'text':
            default: {
                inputEl = document.createElement('input');
                inputEl.type = 'text';
                inputEl.className = 'input';
                inputEl.id = `form-${q.id}`;
                inputEl.placeholder = q.placeholder || '';
                group.appendChild(inputEl);
                break;
            }
        }

        fieldEls[q.id] = { el: inputEl, type: q.type, customInputEl };
        container.appendChild(group);
    });

    return {
        getValues() {
            const values = {};
            for (const [id, field] of Object.entries(fieldEls)) {
                if (field.type === 'checkbox') {
                    values[id] = field.el.checked;
                } else if (field.type === 'slider') {
                    values[id] = Number(field.el.value);
                } else if (field.type === 'select' && field.el.value === '기타(직접 입력)') {
                    values[id] = field.customInputEl.value.trim() || '기타(직접 입력)';
                } else {
                    values[id] = field.el.value;
                }
            }
            return values;
        },
    };
}
