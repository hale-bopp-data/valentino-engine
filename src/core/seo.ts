/**
 * SEO — Pure types for page-level SEO metadata.
 * Migrated from easyway-portal runtime-pages.ts (PBI #606).
 * DOM manipulation (applyPageSeo, applySchemaOrg) stays in the portal consumer.
 * Only types live here.
 */

export type SeoSpec = {
    metaTitle?: string;
    metaDescription?: string;
    ogImage?: string;
    canonical?: string;
};

/**
 * Build a Schema.org WebPage object from pure data.
 * Returns a plain object — the consumer decides how to inject it (DOM, SSR, etc.).
 */
export function buildWebPageSchema(options: {
    title: string;
    url: string;
    description?: string;
    image?: string;
    breadcrumbName?: string;
    breadcrumbBaseUrl?: string;
    sectionTypes?: string[];
}): Record<string, unknown> {
    const schema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        'name': options.title,
        'url': options.url,
    };

    if (options.description) schema.description = options.description;
    if (options.image) schema.primaryImageOfPage = { '@type': 'ImageObject', 'url': options.image };

    // Breadcrumb
    if (options.breadcrumbName && options.breadcrumbBaseUrl) {
        schema.breadcrumb = {
            '@type': 'BreadcrumbList',
            'itemListElement': [
                { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': options.breadcrumbBaseUrl + '/' },
                { '@type': 'ListItem', 'position': 2, 'name': options.breadcrumbName, 'item': options.url },
            ],
        };
    }

    // Adaptive mainEntity based on section types
    if (options.sectionTypes) {
        if (options.sectionTypes.includes('form')) {
            schema.mainEntity = { '@type': 'ContactPoint', 'contactType': 'customer service' };
        } else if (options.sectionTypes.includes('cards')) {
            schema.mainEntity = {
                '@type': 'ItemList',
                'numberOfItems': options.sectionTypes.filter((t) => t === 'cards').length,
            };
        } else if (options.sectionTypes.includes('advisor')) {
            schema.mainEntity = { '@type': 'Service', 'name': options.title, 'serviceType': 'AI Advisory' };
        }
    }

    return schema;
}
