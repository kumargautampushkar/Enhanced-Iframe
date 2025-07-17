const { Plugin } = require('obsidian');

const RESIZABLE_IFRAME_WRAPPER_CLASS = 'resizable-iframe-wrapper';
const PROCESSED_IFRAME_ATTRIBUTE = 'data-resizable-iframe-processed';

module.exports = class ResizableIframesPlugin extends Plugin {

    // MutationObserver to watch for iframes being added to the DOM.
    observer;

    /**
     * This method is called when the plugin is loaded.
     */
    async onload() {
        console.log('Loading Resizable Iframes plugin');

        // This is the core function that finds and wraps iframes.
        this.processIframes = () => {
            // Find all iframes in the workspace that haven't been processed yet.
            const iframes = document.querySelectorAll(`iframe:not([${PROCESSED_IFRAME_ATTRIBUTE}])`);
            iframes.forEach(this.wrapIframe.bind(this));
        };

        // The MutationObserver callback, which triggers processing when the DOM changes.
        this.observer = new MutationObserver((mutations) => {
            // Use a flag to avoid reprocessing iframes multiple times in one go.
            let iframesAdded = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        // Check if the added node is an iframe or contains iframes.
                        if (node.nodeName === 'IFRAME' || (node.querySelector && node.querySelector('iframe'))) {
                           iframesAdded = true;
                        }
                    });
                }
            }
            if (iframesAdded) {
                this.processIframes();
            }
        });

        // Start observing the entire workspace for changes.
        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Run an initial scan to process any iframes already present on load.
        this.app.workspace.onLayoutReady(() => {
            this.processIframes();
        });
    }

    /**
     * This method is called when the plugin is unloaded.
     */
    onunload() {
        console.log('Unloading Resizable Iframes plugin');

        // Disconnect the observer to stop watching for DOM changes.
        if (this.observer) {
            this.observer.disconnect();
        }

        // Clean up by unwrapping all the iframes that the plugin has modified.
        document.querySelectorAll(`.${RESIZABLE_IFRAME_WRAPPER_CLASS}`).forEach(wrapper => {
            const iframe = wrapper.querySelector('iframe');
            if (iframe) {
                // Move the iframe out of the wrapper, right before it.
                wrapper.parentNode.insertBefore(iframe, wrapper);
                // Remove the processed attribute from the iframe.
                iframe.removeAttribute(PROCESSED_IFRAME_ATTRIBUTE);
            }
            // Remove the wrapper div.
            wrapper.remove();
        });
    }

    /**
     * Wraps a single iframe element with a resizable container.
     * @param {HTMLIFrameElement} iframeEl The iframe element to wrap.
     */
    wrapIframe(iframeEl) {
        // Double-check that we are not processing an already-processed iframe.
        if (iframeEl.hasAttribute(PROCESSED_IFRAME_ATTRIBUTE)) {
            return;
        }

        // Prevent styling conflicts with existing parent elements.
        if (iframeEl.parentElement.classList.contains(RESIZABLE_IFRAME_WRAPPER_CLASS)) {
            return;
        }

        console.log('Wrapping an iframe:', iframeEl.src || 'No src');

        // Create the wrapper div.
        const wrapper = document.createElement('div');
        wrapper.classList.add(RESIZABLE_IFRAME_WRAPPER_CLASS);

        // Get the initial dimensions from the iframe, or use defaults.
        const initialWidth = iframeEl.width || '600px'; // Default width if not set
        const initialHeight = iframeEl.height || '450px'; // Default height if not set
        wrapper.style.width = initialWidth.endsWith('px') ? initialWidth : `${initialWidth}px`;
        wrapper.style.height = initialHeight.endsWith('px') ? initialHeight : `${initialHeight}px`;

        // Insert the wrapper into the DOM right before the iframe.
        iframeEl.parentNode.insertBefore(wrapper, iframeEl);

        // Move the iframe inside the wrapper.
        wrapper.appendChild(iframeEl);

        // Mark the iframe as processed to prevent re-wrapping.
        iframeEl.setAttribute(PROCESSED_IFRAME_ATTRIBUTE, 'true');
    }
}
