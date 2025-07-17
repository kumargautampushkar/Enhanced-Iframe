// main.ts
import { Plugin, MarkdownView, MarkdownPostProcessorContext } from 'obsidian';

interface IframeResizerSettings {
    minWidth: number;
    minHeight: number;
    handleSize: number;
    handleColor: string;
}

const DEFAULT_SETTINGS: IframeResizerSettings = {
    minWidth: 200,
    minHeight: 150,
    handleSize: 10,
    handleColor: '#007acc'
};

export default class IframeResizerPlugin extends Plugin {
    settings: IframeResizerSettings;

    async onload() {
        await this.loadSettings();

        // Register the markdown post processor
        this.registerMarkdownPostProcessor((element, context) => {
            const iframes = element.querySelectorAll('iframe');
            iframes.forEach(iframe => {
                this.makeIframeResizable(iframe);
            });
        });

        // Handle iframes in existing notes when plugin loads
        this.app.workspace.iterateRootLeaves((leaf) => {
            if (leaf.view instanceof MarkdownView) {
                const view = leaf.view;
                const iframes = view.contentEl.querySelectorAll('iframe:not(.iframe-processed)');
                iframes.forEach(iframe => {
                    this.makeIframeResizable(iframe);
                });
            }
        });

        // Add settings tab
        this.addSettingTab(new IframeResizerSettingTab(this.app, this));
    }

    makeIframeResizable(iframe: HTMLIFrameElement) {
        // Skip if already processed
        if (iframe.classList.contains('iframe-processed')) {
            return;
        }
        iframe.classList.add('iframe-processed');

        // Get original dimensions
        const computedStyle = window.getComputedStyle(iframe);
        let width = iframe.width || computedStyle.width || '600px';
        let height = iframe.height || computedStyle.height || '400px';

        // Convert to pixels if needed
        if (typeof width === 'string' && width.includes('%')) {
            width = '600px'; // Default width for percentage-based iframes
        }
        if (typeof height === 'string' && height.includes('%')) {
            height = '400px'; // Default height for percentage-based iframes
        }

        // Ensure we have pixel values
        width = typeof width === 'string' ? width : `${width}px`;
        height = typeof height === 'string' ? height : `${height}px`;

        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.classList.add('iframe-resizer-wrapper');
        wrapper.style.width = width;
        wrapper.style.height = height;
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';
        wrapper.style.overflow = 'hidden';
        wrapper.style.boxSizing = 'border-box';

        // Insert wrapper and move iframe into it
        if (iframe.parentNode) {
            iframe.parentNode.insertBefore(wrapper, iframe);
            wrapper.appendChild(iframe);
        }

        // Reset iframe styles to fill wrapper
        iframe.style.position = 'absolute';
        iframe.style.top = '0';
        iframe.style.left = '0';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.display = 'block';
        iframe.removeAttribute('width');
        iframe.removeAttribute('height');

        // Create resize handles
        this.createResizeHandle(wrapper, 'bottom-right');
        this.createResizeHandle(wrapper, 'bottom');
        this.createResizeHandle(wrapper, 'right');
    }

    createResizeHandle(wrapper: HTMLElement, position: 'bottom-right' | 'bottom' | 'right') {
        const handle = document.createElement('div');
        handle.classList.add('iframe-resize-handle', `handle-${position}`);
        
        // Style the handle
        handle.style.position = 'absolute';
        handle.style.background = this.settings.handleColor;
        handle.style.opacity = '0';
        handle.style.transition = 'opacity 0.2s';
        handle.style.zIndex = '10';

        if (position === 'bottom-right') {
            handle.style.width = `${this.settings.handleSize}px`;
            handle.style.height = `${this.settings.handleSize}px`;
            handle.style.bottom = '0';
            handle.style.right = '0';
            handle.style.cursor = 'nwse-resize';
            handle.style.borderRadius = '0 0 0 3px';
        } else if (position === 'bottom') {
            handle.style.width = '100%';
            handle.style.height = `${this.settings.handleSize / 2}px`;
            handle.style.bottom = '0';
            handle.style.left = '0';
            handle.style.cursor = 'ns-resize';
        } else if (position === 'right') {
            handle.style.width = `${this.settings.handleSize / 2}px`;
            handle.style.height = '100%';
            handle.style.top = '0';
            handle.style.right = '0';
            handle.style.cursor = 'ew-resize';
        }

        // Show handle on hover
        wrapper.addEventListener('mouseenter', () => {
            handle.style.opacity = '0.5';
        });
        wrapper.addEventListener('mouseleave', () => {
            if (!handle.classList.contains('resizing')) {
                handle.style.opacity = '0';
            }
        });

        // Add resize functionality
        this.addResizeListener(handle, wrapper, position);
        wrapper.appendChild(handle);
    }

    addResizeListener(handle: HTMLElement, wrapper: HTMLElement, position: string) {
        let isResizing = false;
        let startX = 0;
        let startY = 0;
        let startWidth = 0;
        let startHeight = 0;

        const startResize = (e: MouseEvent) => {
            isResizing = true;
            handle.classList.add('resizing');
            startX = e.clientX;
            startY = e.clientY;
            startWidth = wrapper.offsetWidth;
            startHeight = wrapper.offsetHeight;

            // Prevent text selection and iframe interaction during resize
            e.preventDefault();
            e.stopPropagation();
            
            // Create overlay to prevent iframe from capturing mouse events
            const overlay = document.createElement('div');
            overlay.id = 'iframe-resize-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 9999;
                cursor: ${handle.style.cursor};
                user-select: none;
            `;
            document.body.appendChild(overlay);
            document.body.style.userSelect = 'none';
        };

        const resize = (e: MouseEvent) => {
            if (!isResizing) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            if (position === 'bottom-right') {
                const newWidth = Math.max(this.settings.minWidth, startWidth + deltaX);
                const newHeight = Math.max(this.settings.minHeight, startHeight + deltaY);
                wrapper.style.width = `${newWidth}px`;
                wrapper.style.height = `${newHeight}px`;
            } else if (position === 'bottom') {
                const newHeight = Math.max(this.settings.minHeight, startHeight + deltaY);
                wrapper.style.height = `${newHeight}px`;
            } else if (position === 'right') {
                const newWidth = Math.max(this.settings.minWidth, startWidth + deltaX);
                wrapper.style.width = `${newWidth}px`;
            }
        };

        const stopResize = () => {
            if (isResizing) {
                isResizing = false;
                handle.classList.remove('resizing');
                document.body.style.userSelect = '';
                
                // Remove overlay
                const overlay = document.getElementById('iframe-resize-overlay');
                overlay?.remove();
                
                // Hide handle if not hovering
                if (!wrapper.matches(':hover')) {
                    handle.style.opacity = '0';
                }
            }
        };

        handle.addEventListener('mousedown', startResize);
        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
        
        // Clean up on plugin unload
        this.register(() => {
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);
        });
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    onunload() {
        // Clean up any remaining overlays
        const overlay = document.getElementById('iframe-resize-overlay');
        overlay?.remove();
        
        // Remove processed class from iframes
        document.querySelectorAll('.iframe-processed').forEach(iframe => {
            iframe.classList.remove('iframe-processed');
        });
    }
}

// Settings tab
import { App, PluginSettingTab, Setting } from 'obsidian';

class IframeResizerSettingTab extends PluginSettingTab {
    plugin: IframeResizerPlugin;

    constructor(app: App, plugin: IframeResizerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Iframe Resizer Settings' });

        new Setting(containerEl)
            .setName('Minimum width')
            .setDesc('Minimum width for resized iframes (in pixels)')
            .addText(text => text
                .setPlaceholder('200')
                .setValue(this.plugin.settings.minWidth.toString())
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.minWidth = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Minimum height')
            .setDesc('Minimum height for resized iframes (in pixels)')
            .addText(text => text
                .setPlaceholder('150')
                .setValue(this.plugin.settings.minHeight.toString())
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.minHeight = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Handle size')
            .setDesc('Size of the resize handles (in pixels)')
            .addText(text => text
                .setPlaceholder('10')
                .setValue(this.plugin.settings.handleSize.toString())
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.handleSize = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Handle color')
            .setDesc('Color of the resize handles')
            .addText(text => text
                .setPlaceholder('#007acc')
                .setValue(this.plugin.settings.handleColor)
                .onChange(async (value) => {
                    this.plugin.settings.handleColor = value;
                    await this.plugin.saveSettings();
                }));
    }
}