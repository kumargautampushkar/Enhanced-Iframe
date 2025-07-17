// main.ts
import { Plugin, MarkdownView } from 'obsidian';

export default class IframeResizerPlugin extends Plugin {
    private observer: MutationObserver | null = null;

    async onload() {
        // Add styles
        this.addStyles();

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

        // Watch for editor changes
        this.registerEvent(
            this.app.workspace.on('editor-change', () => {
                setTimeout(() => this.processAllIframes(), 500);
            })
        );
    }

    startObserving() {
        // Create mutation observer to watch for new iframes
        this.observer = new MutationObserver((mutations) => {
            let hasNewIframes = false;
            
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node instanceof HTMLElement) {
                        if (node.tagName === 'IFRAME' || 
                            node.querySelector('iframe') || 
                            node.classList.contains('external-embed') ||
                            node.classList.contains('media-embed')) {
                            hasNewIframes = true;
                        }
                    }
                });
            });
            
            if (hasNewIframes) {
                setTimeout(() => this.processAllIframes(), 100);
            }
        });

        // Start observing the entire workspace
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

            .iframe-container iframe {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                border: none;
                display: block;
            }

            /* Handle for Obsidian's media embeds */
            .iframe-container .media-embed,
            .iframe-container .external-embed {
                width: 100% !important;
                height: 100% !important;
                position: relative;
            }

            .iframe-container .media-embed iframe,
            .iframe-container .external-embed iframe {
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
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

            /* Fix for internal embeds */
            .internal-embed .iframe-container {
                width: 100%;
            }
        `;
        document.head.appendChild(styleEl);
    }

    processAllIframes() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) return;

        const contentEl = activeView.contentEl;
        
        // Process regular iframes
        const iframes = contentEl.querySelectorAll('iframe');
        iframes.forEach((iframe: HTMLIFrameElement) => {
            // Skip if already processed
            if (iframe.closest('.iframe-container')) {
                return;
            }
            this.wrapIframe(iframe);
        });

        // Process Obsidian media embeds (from ![](URL) syntax)
        const mediaEmbeds = contentEl.querySelectorAll('.media-embed, .external-embed');
        mediaEmbeds.forEach((embed: HTMLElement) => {
            // Skip if already processed
            if (embed.closest('.iframe-container')) {
                return;
            }
            
            const iframe = embed.querySelector('iframe');
            if (iframe) {
                this.wrapEmbed(embed);
            }
        });
    }

    wrapIframe(iframe: HTMLIFrameElement) {
        // Create container
        const container = document.createElement('div');
        container.className = 'iframe-container';
        
        // Get dimensions
        let width = '600px';
        let height = '400px';
        
        // Check iframe attributes
        if (iframe.width) {
            width = isNaN(Number(iframe.width)) ? iframe.width : `${iframe.width}px`;
        } else if (iframe.style.width && iframe.style.width !== '100%') {
            width = iframe.style.width;
        }
        
        if (iframe.height) {
            height = isNaN(Number(iframe.height)) ? iframe.height : `${iframe.height}px`;
        } else if (iframe.style.height && iframe.style.height !== '100%') {
            height = iframe.style.height;
        }
        
        // For Obsidian embeds, check parent dimensions
        const parent = iframe.parentElement;
        if (parent && (parent.classList.contains('media-embed') || parent.classList.contains('external-embed'))) {
            if (parent.style.width) width = parent.style.width;
            if (parent.style.height) height = parent.style.height;
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

    wrapEmbed(embed: HTMLElement) {
        // Create container
        const container = document.createElement('div');
        container.className = 'iframe-container';
        
        // Get dimensions from the embed
        let width = '600px';
        let height = '400px';
        
        if (embed.style.width && embed.style.width !== '100%') {
            width = embed.style.width;
        }
        if (embed.style.height && embed.style.height !== '100%') {
            height = embed.style.height;
        }
        
        // Set container dimensions
        container.style.width = width;
        container.style.height = height;
        
        // Insert container and move embed
        embed.parentNode?.insertBefore(container, embed);
        container.appendChild(embed);
        
        // Clear embed dimensions
        embed.style.width = '';
        embed.style.height = '';
    }

    onunload() {
        // Stop observing
        if (this.observer) {
            this.observer.disconnect();
        }

        // Remove styles
        document.getElementById('iframe-resizer-styles')?.remove();
        
        // Unwrap all iframes and embeds
        document.querySelectorAll('.iframe-container').forEach(container => {
            const content = container.firstElementChild;
            if (content && container.parentNode) {
                // Restore dimensions if it's an embed
                if (content.classList.contains('media-embed') || content.classList.contains('external-embed')) {
                    (content as HTMLElement).style.width = container.style.width;
                    (content as HTMLElement).style.height = container.style.height;
                }
                container.parentNode.insertBefore(content, container);
                container.remove();
            }
        });
    }
}