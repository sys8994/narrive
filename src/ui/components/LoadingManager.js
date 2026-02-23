/**
 * LoadingManager.js — Cinematic loading UI manager with blur/fade transitions
 * @module ui/components/LoadingManager
 */

class LoadingManager {
    constructor() {
        this.overlay = null;
        this.textEl = null;
        this.intervalId = null;
        this.messages = [];
        this.currentIndex = 0;
        this.isStopping = false;

        this._initDOM();
    }

    _initDOM() {
        // Create overlay if not present
        this.overlay = document.querySelector('.loading-overlay');
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.className = 'loading-overlay';
            this.textEl = document.createElement('div');
            this.textEl.className = 'loading-text';
            this.overlay.appendChild(this.textEl);
            document.body.appendChild(this.overlay);
        } else {
            this.textEl = this.overlay.querySelector('.loading-text');
        }
    }

    /**
     * Start the cinematic loading sequence
     * @param {string} phase - Loading phase identifier
     * @param {Object} dynamicData - User context for dynamic messages
     */
    startLoading(phase, dynamicData = {}) {
        this.isStopping = false;
        this.currentIndex = 0;
        this._prepareMessages(phase, dynamicData);

        // Reset state
        this.overlay.classList.add('active');
        this._showNextMessage();

        // Cycle messages
        this.intervalId = setInterval(() => {
            if (this.isStopping) return;
            this._showNextMessage();
        }, 3000);
    }

    /**
     * Stop loading with a final graceful message
     * @param {string} finalMessage - The last message before closing
     */
    stopLoading(finalMessage = "이야기의 문이 열립니다.") {
        if (this.isStopping) return;
        this.isStopping = true;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        // Show final message gracefully
        this._updateText(finalMessage);

        // Wait for final message to be read, then fade out overlay
        setTimeout(() => {
            this.overlay.classList.remove('active');
            setTimeout(() => {
                this.textEl.classList.remove('visible');
                this.textEl.textContent = '';
            }, 800);
        }, 2000);
    }

    _prepareMessages(phase, data) {
        const theme = data.theme || '모험';
        const situation = data.situation || '새로운 국면';

        switch (phase) {
            case 'p1_init':
                this.messages = [
                    "이야기의 씨앗을 심고 있습니다.",
                    `[${theme}] 테마의 원형을 구성 중.`,
                    "세계관의 토대를 다지는 중입니다.",
                    "인과율의 초석을 기술합니다."
                ];
                break;
            case 'p2_generate':
                this.messages = [
                    `[${theme}] 세계의 질감을 조율 중.`,
                    `[${situation}]의 상황을 구체화합니다.`,
                    "서사의 필연성을 검증하는 중.",
                    "이야기의 세부를 조각하고 있습니다.",
                    "준비가 거의 끝났습니다."
                ];
                break;
            default:
                this.messages = [
                    "공간의 농도를 맞추는 중...",
                    "시간의 흐름을 조율하고 있습니다.",
                    "이야기의 뼈대를 세우는 중."
                ];
        }
    }

    async _showNextMessage() {
        const msg = this.messages[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.messages.length;

        await this._updateText(msg);
    }

    _updateText(msg) {
        return new Promise(resolve => {
            // Fade out
            this.textEl.classList.remove('visible');

            setTimeout(() => {
                this.textEl.textContent = msg;
                // Fade in
                this.textEl.classList.add('visible');
                setTimeout(resolve, 1000);
            }, 1000);
        });
    }
}

export const loadingManager = new LoadingManager();
