import type { ParamTypes } from './GENERATED-param-types';
import { getParamType } from './main';
import { corePart } from './parts/core/core-part';
import { InferParams, Part, getPartParams, paramValueToCss } from './theme-types';
import { paramToVariableName } from './theme-utils';
import { VERSION } from './version';

export type ThemeArgs = {
    parts: Part | Part[];
    params?: Partial<ParamTypes>;
};

export type ThemeInstallArgs = {
    container?: HTMLElement;
};

export class Theme {
    constructor(private args: ThemeArgs) {}

    private parts?: Part[];
    public getParts(): Part[] {
        if (this.parts) return this.parts;
        // For parts with a partId, only allow one variant allowed, last variant wins
        const removeDuplicates: Record<string, Part> = { [corePart.partId]: corePart };
        for (const part of flattenParts(this.args.parts)) {
            // remove any existing item before overwriting, so that the newly added part
            // is ordered at the end of the list
            delete removeDuplicates[part.partId];
            removeDuplicates[part.partId] = part;
        }
        return (this.parts = Object.values(removeDuplicates));
    }

    private mergedParams?: Partial<ParamTypes>;
    /**
     * Return the actual params used to render the theme, including defaults
     * provided by the theme parts and params passed to the Theme constructor
     */
    public getParams(): Partial<ParamTypes> {
        if (this.mergedParams) return this.mergedParams;

        const parts = this.getParts();
        const mergedParams: any = {};

        for (const part of parts) {
            Object.assign(mergedParams, part.defaults);
        }

        const allowedParams = new Set<string>(parts.flatMap((part) => getPartParams(part)));

        for (const [name, value] of Object.entries(this.args.params || {})) {
            if (value == null) continue;
            if (allowedParams.has(name)) {
                mergedParams[name] = value;
            } else {
                logErrorMessageOnce(
                    `Invalid theme parameter ${name} provided. It may be misspelled, or defined by a theme part that you aren't currently using.`
                );
            }
        }

        return (this.mergedParams = mergedParams);
    }

    private renderedParams?: Record<string, string>;
    /**
     * Return the values of the params as CSS strings
     */
    public getRenderedParams(): Record<string, string> {
        if (this.renderedParams) return this.renderedParams;

        const mergedParams = this.getParams();
        const renderedParams: Record<string, string> = {};

        for (const [name, value] of Object.entries(mergedParams)) {
            const rendered = paramValueToCss(name, value);
            if (rendered instanceof Error) {
                logErrorMessageOnce(`Invalid value for ${name} - ${describeValue(value)} - ${rendered.message}`);
            } else if (rendered) {
                renderedParams[name] = rendered;
            }
        }

        return (this.renderedParams = renderedParams);
    }

    private cssChunks?: ThemeCssChunk[];
    public getCSSChunks(): ThemeCssChunk[] {
        if (this.cssChunks) return this.cssChunks;

        const chunks: ThemeCssChunk[] = [];

        const googleFonts = this.makeGoogleFontsChunk();
        if (googleFonts) chunks.push(googleFonts);

        chunks.push(this.makeVariablesChunk());

        for (const part of this.getParts()) {
            if (part.css) {
                let css = `/* Part ${part.partId}/${part.variantId} */`;
                css += part.css.map((p) => (typeof p === 'function' ? p() : p)).join('\n') + '\n';
                chunks.push({
                    css,
                    // TODO this can just be variantId once we make variantId include partId
                    id: `${part.partId}/${part.variantId}`,
                });
            }
        }

        return (this.cssChunks = chunks);
    }

    /**
     * Inject CSS for this theme into the head of the current page
     *
     * @param args.container The container that the grid is rendered within. If
     * the grid is rendered inside a shadow DOM root, you must pass the grid's
     * parent element to ensure that the styles are adopted into the shadow DOM.
     */
    public install(args: ThemeInstallArgs = {}) {
        let container = args.container || null;
        if (!container) {
            container = document.querySelector('head');
            if (!container) throw new Error("Can't install theme before document head is created");
        }
        for (const chunk of this.getCSSChunks()) {
            const documentStyles = document.adoptedStyleSheets as AnnotatedStylesheet[];
            let style = documentStyles.find((s) => s._agId === chunk.id);
            if (!style) {
                style = new CSSStyleSheet();
                style._agId = chunk.id;
                document.adoptedStyleSheets.push(style);
            }
            if (style._agTextContent !== chunk.css) {
                style.replaceSync(chunk.css);
                style._agTextContent = chunk.css;
            }
            const shadowRoot = container.getRootNode();
            if (shadowRoot instanceof ShadowRoot) {
                const allDocumentStyles = new Set(documentStyles);
                shadowRoot.adoptedStyleSheets = shadowRoot.adoptedStyleSheets.filter((s) => allDocumentStyles.has(s));
                const allShadowStyles = new Set(shadowRoot.adoptedStyleSheets);
                for (const style of documentStyles) {
                    if (!allShadowStyles.has(style)) {
                        shadowRoot.adoptedStyleSheets.push(style);
                    }
                }
            }
        }
    }

    public getCSS(): string {
        return (
            fileHeader(this.args.params || {}) +
            this.getCSSChunks()
                .map((chunk) => chunk.css)
                .join('\n\n')
        );
    }

    private makeGoogleFontsChunk(): ThemeCssChunk | null {
        const googleFonts = new Set<string>();
        const fontWeights = new Set<number>([400]);

        // find Google fonts
        for (const [name, value] of Object.entries(this.getParams())) {
            const addFont = (value: unknown) => {
                const googlePrefix = 'google:';
                if (typeof value === 'string' && value.startsWith(googlePrefix)) {
                    googleFonts.add(value.replace(googlePrefix, ''));
                }
            };
            const paramType = getParamType(name);
            if (paramType === 'fontFamily') {
                if (Array.isArray(value)) {
                    value.forEach(addFont);
                } else {
                    addFont(value);
                }
            } else if (paramType === 'fontWeight') {
                const parsed = parseFloat(value as string);
                if (!isNaN(parsed)) {
                    fontWeights.add(parsed);
                } else if (value === 'bold') {
                    fontWeights.add(700);
                }
            }
        }

        const weights = ':wght@' + Array.from(fontWeights).sort().join(';');
        const css = Array.from(googleFonts)
            .sort()
            .map(
                (font) =>
                    `@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}${weights}&display=swap');\n`
            )
            .join('');

        return {
            css,
            id: 'googleFonts',
        };
    }

    private makeVariablesChunk(): ThemeCssChunk {
        // render variable defaults using :where(:root) to ensure lowest specificity so that
        // `html { --ag-foreground-color: red; }` will override this
        let css = '.ag-theme-custom {\n';
        for (const [name, rendered] of Object.entries(this.getRenderedParams())) {
            css += `\t${paramToVariableName(name)}: ${rendered};\n`;
        }
        css += '}\n';
        return {
            css,
            id: 'variables',
        };
    }
}

export type ThemeCssChunk = {
    css: string;
    id: string;
};

type AnnotatedStylesheet = CSSStyleSheet & {
    _agId?: string;
    _agTextContent?: string;
};

const flattenParts = (parts: Part | Part[], accumulator: Part[] = []) => {
    for (const part of Array.isArray(parts) ? parts : [parts]) {
        if (part.dependencies) {
            flattenParts(part.dependencies(), accumulator);
        }
        accumulator.push(part);
    }
    return accumulator;
};

export type PickVariables<P extends Part, V extends object> = {
    [K in InferParams<P>]?: K extends keyof V ? V[K] : never;
};

export const installDocsUrl =
    'https://www.ag-grid.com/javascript-data-grid/global-style-customisation-theme-builder-integration/';

// TODO remove this when public theme builder API released
export const gridVersionTieWarning = `we are working to remove this restriction, but themes exported from the Theme Builder are for the current grid version (${VERSION}) and will not be automatically updated with new features and bug fixes in later versions. If you upgrade your application's grid version and experience issues, return to the Theme Builder to download an updated version of your theme.`;

const fileHeader = (parameters: Record<string, unknown>) => `/*
 * This file is a theme downloaded from the AG Grid Theme Builder for AG Grid ${VERSION}.
 *
 * See installation docs at ${installDocsUrl}
 * 
 * Theme generated based on these settings: ${JSON.stringify(Object.fromEntries(Object.entries(parameters).filter(([, value]) => value != null)), null, 2).replaceAll('\n', '\n * ')}
 */

`;

const describeValue = (value: any): string => {
    if (value == null) return String(value);
    return `${typeof value} ${value}`;
};

const loggedMessages = new Set<string>();
const logErrorMessageOnce = (message: string) => {
    if (loggedMessages.has(message)) return;
    loggedMessages.add(message);
    console.error(message);
};
