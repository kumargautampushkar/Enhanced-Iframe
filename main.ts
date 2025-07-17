// main.ts
import { Plugin, MarkdownView } from 'obsidian';

export default class IframeResizerPlugin extends Plugin {
    private resizeObserver: ResizeObserver | null = null;

    async onload() {
        // Add styles
        this.addStyles();

        // Process iframes when layout changes
        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                this.processAllIframes();
            })
        );

        // Process iframes in active file when it changes
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                setTimeout(() => this.processAllIframes(), 100);
            })
        );

        // Initial processing
        this.app.workspace.onLayoutReady(() => {
            this.processAllIframes();
        });

        // Watch for DOM changes
        this.registerDomEvent(document, 'click', () => {
            setTimeout(() => this.processAllIframes(), 100);
        });
    }

    addStyles() {
        const styleEl = document.createElement('style');
        styleEl.id = 'iframe-resizer-styles';
        styleEl.textContent = `
            .iframe-container {
                position: relative;
                display: inline-block;
                min-width: 200px;
                min-height: 150px;
                border: 2px solid transparent;
                transition: border-color 0.2s;
                resize: both;
                overflow: auto;
                max-width: 100%;
            }

            .iframe-container:hover {
                border-color: var(--interactive-accent);
            }

            .iframe-container iframe {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                border: none;
                display: block;
            }

            /* Resize handle styling */
            .iframe-container::-webkit-resizer {
                background-color: transparent;
                background-image: linear-gradient(-45deg, 
                    transparent 40%, 
                    var(--interactive-accent) 40%, 
                    var(--interactive-accent) 60%, 
                    transparent 60%);
            }

            .iframe-container::after {
                content: '';
                position: absolute;
                bottom: 0;
                right: 0;
                width: 20px;
                height: 20px;
                cursor: nwse-resize;
                background: linear-gradient(
                    135deg,
                    transparent 50%,
                    var(--interactive-accent) 50%
                );
                opacity: 0;
                transition: opacity 0.2s;
                pointer-events: none;
            }

            .iframe-container:hover::after {
                opacity: 0.3;
            }
        `;
        document.head.appendChild(styleEl);
    }

    processAllIframes() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) return;

        const contentEl = activeView.contentEl;
        const iframes = contentEl.querySelectorAll('iframe');
        
        iframes.forEach((iframe: HTMLIFrameElement) => {
            // Skip if already processed
            if (iframe.parentElement?.classList.contains('iframe-container')) {
                return;
            }

            this.wrapIframe(iframe);
        });
    }

    wrapIframe(iframe: HTMLIFrameElement) {
        // Create container
        const container = document.createElement('div');
        container.className = 'iframe-container';
        
        // Get dimensions
        let width = '600px';
        let height = '400px';
        
        if (iframe.width) {
            width = isNaN(Number(iframe.width)) ? iframe.width : `${iframe.width}px`;
        } else if (iframe.style.width) {
            width = iframe.style.width;
        }
        
        if (iframe.height) {
            height = isNaN(Number(iframe.height)) ? iframe.height : `${iframe.height}px`;
        } else if (iframe.style.height) {
            height = iframe.style.height;
        }
        
        // Set container dimensions
        container.style.width = width;
        container.style.height = height;
        
        // Insert container and move iframe
        iframe.parentNode?.insertBefore(container, iframe);
        container.appendChild(iframe);
        
        // Clear iframe dimensions so it fills container
        iframe.removeAttribute('width');
        iframe.removeAttribute('height');
        iframe.style.width = '';
        iframe.style.height = '';
    }

    onunload() {
        // Remove styles
        document.getElementById('iframe-resizer-styles')?.remove();
        
        // Unwrap iframes
        document.querySelectorAll('.iframe-container').forEach(container => {
            const iframe = container.querySelector('iframe');
            if (iframe && container.parentNode) {
                container.parentNode.insertBefore(iframe, container);
                container.remove();
            }
        });
    }
}