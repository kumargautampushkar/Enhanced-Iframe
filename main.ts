// main.ts
import { Plugin, MarkdownView } from 'obsidian';

export default class IframeResizerPlugin extends Plugin {
    private observer: MutationObserver | null = null;
    private resizeData: Map<string, {width: string, height: string}> = new Map();

    async onload() {
        // Add styles
        this.addStyles();

        // Load saved resize data
        const savedData = await this.loadData();
        if (savedData?.resizeData) {
            this.resizeData = new Map(Object.entries(savedData.resizeData));
        }

        // Process iframes when layout changes
        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                setTimeout(() => this.processAllIframes(), 100);
            })
        );

        // Process iframes in active file when it changes
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                setTimeout(() => this.processAllIframes(), 200);
            })
        );

        // Initial processing
        this.app.workspace.onLayoutReady(() => {
            this.processAllIframes();
            this.startObserving();
        });

        // Save resize data periodically
        this.registerInterval(
            window.setInterval(() => this.saveResizeData(), 5000)
        );
    }

    startObserving() {
        this.observer = new MutationObserver((mutations) => {
            let shouldProcess = false;
            
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node instanceof HTMLElement) {
                        // Check for iframes and Obsidian embeds
                        if (node.tagName === 'IFRAME' || 
                            node.querySelector('iframe') || 
                            node.classList.contains('media-embed-embed') ||
                            node.classList.contains('internal-embed')) {
                            shouldProcess = true;
                        }
                    }
                });
            });
            
            if (shouldProcess) {
                setTimeout(() => this.processAllIframes(), 100);
            }
        });

        const workspaceEl = document.querySelector('.workspace');
        if (workspaceEl) {
            this.observer.observe(workspaceEl, {
                childList: true,
                subtree: true
            });
        }
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
                margin: 5px 0;
            }

            .iframe-container:hover {
                border-color: var(--interactive-accent);
            }

            .iframe-container > iframe,
            .iframe-container .internal-embed iframe {
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                border: none !important;
                display: block !important;
            }

            /* Handle internal embeds */
            .iframe-container > .internal-embed {
                width: 100% !important;
                height: 100% !important;
                position: relative;
            }

            .iframe-container > .internal-embed > * {
                width: 100% !important;
                height: 100% !important;
            }

            /* Resize handle styling */
            .iframe-container::-webkit-resizer {
                background-color: transparent;
            }

            .iframe-container::after {
                content: '';
                position: absolute;
                bottom: 0;
                right: 0;
                width: 16px;
                height: 16px;
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
                opacity: 0.5;
            }

            /* Prevent iframe interaction during resize */
            .iframe-container:active iframe {
                pointer-events: none;
            }
        `;
        document.head.appendChild(styleEl);
    }

    processAllIframes() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) return;

        const contentEl = activeView.contentEl;
        
        // Process all iframes, including those in embeds
        const allIframes = contentEl.querySelectorAll('iframe');
        allIframes.forEach((iframe: HTMLIFrameElement) => {
            // Skip if already in a container
            if (iframe.closest('.iframe-container')) {
                return;
            }

            // Check if this is part of an internal embed
            const internalEmbed = iframe.closest('.internal-embed');
            if (internalEmbed && !internalEmbed.parentElement?.classList.contains('iframe-container')) {
                this.wrapElement(internalEmbed as HTMLElement, iframe);
            } else if (!internalEmbed) {
                this.wrapElement(iframe, iframe);
            }
        });

        // Restore saved sizes
        this.restoreSavedSizes();
    }

    wrapElement(elementToWrap: HTMLElement, iframe: HTMLIFrameElement) {
        // Create container
        const container = document.createElement('div');
        container.className = 'iframe-container';
        
        // Generate ID for this iframe based on src
        const iframeId = this.getIframeId(iframe);
        container.setAttribute('data-iframe-id', iframeId);
        
        // Get dimensions
        let width = '600px';
        let height = '400px';
        
        // Check for saved dimensions first
        const saved = this.resizeData.get(iframeId);
        if (saved) {
            width = saved.width;
            height = saved.height;
        } else {
            // Try to get dimensions from the element
            const computedStyle = window.getComputedStyle(elementToWrap);
            if (computedStyle.width && computedStyle.width !== 'auto' && computedStyle.width !== '100%') {
                width = computedStyle.width;
            }
            if (computedStyle.height && computedStyle.height !== 'auto' && computedStyle.height !== '100%') {
                height = computedStyle.height;
            }
        }
        
        // Set container dimensions
        container.style.width = width;
        container.style.height = height;
        
        // Insert container and move element
        elementToWrap.parentNode?.insertBefore(container, elementToWrap);
        container.appendChild(elementToWrap);
        
        // Add resize observer to save dimensions
        this.observeResize(container);
    }

    getIframeId(iframe: HTMLIFrameElement): string {
        // Create a unique ID based on the iframe src
        const src = iframe.src || iframe.getAttribute('src') || '';
        return btoa(src).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    }

    observeResize(container: HTMLElement) {
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const target = entry.target as HTMLElement;
                const iframeId = target.getAttribute('data-iframe-id');
                if (iframeId) {
                    this.resizeData.set(iframeId, {
                        width: target.style.width,
                        height: target.style.height
                    });
                }
            }
        });
        
        resizeObserver.observe(container);
        
        // Store observer for cleanup
        this.register(() => resizeObserver.disconnect());
    }

    restoreSavedSizes() {
        document.querySelectorAll('.iframe-container[data-iframe-id]').forEach((container: HTMLElement) => {
            const iframeId = container.getAttribute('data-iframe-id');
            if (iframeId) {
                const saved = this.resizeData.get(iframeId);
                if (saved) {
                    container.style.width = saved.width;
                    container.style.height = saved.height;
                }
            }
        });
    }

    async saveResizeData() {
        const dataToSave = {
            resizeData: Object.fromEntries(this.resizeData)
        };
        await this.saveData(dataToSave);
    }

    async onunload() {
        // Save final resize data
        await this.saveResizeData();

        // Stop observing
        if (this.observer) {
            this.observer.disconnect();
        }

        // Remove styles
        document.getElementById('iframe-resizer-styles')?.remove();
        
        // Unwrap all containers
        document.querySelectorAll('.iframe-container').forEach(container => {
            const content = container.firstElementChild;
            if (content && container.parentNode) {
                container.parentNode.insertBefore(content, container);
                container.remove();
            }
        });
    }
}