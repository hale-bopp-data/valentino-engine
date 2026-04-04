/**
 * Provider-agnostic configuration and payload types for Valentino Engine.
 */

export type BaseProviderConfig = {
    /** The authentication key for the provider (if required) */
    apiKey?: string;
    /** The target model string */
    model?: string;
    /** The endpoint base URL overriding provider defaults */
    baseUrl?: string;
    /** Maximum tokens to generate (default usually 1024) */
    maxTokens?: number;
    /** Sampling temperature (default usually 0.1 for structured output) */
    temperature?: number;
};

export type ProviderMessage = {
    role: 'system' | 'user' | 'assistant';
    content: string;
};
