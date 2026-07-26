/**
 * Adapter Configuration Types
 * 
 * Each adapter has its own configuration schema based on its parameters
 */

// Greenhouse: company board tokens
export interface GreenhouseConfig {
  type: 'greenhouse';
  boards: Array<{
    token: string;      // e.g., "stripe"
    name: string;       // e.g., "Stripe"
    enabled: boolean;
  }>;
}

// Workday: tenant identifiers
export interface WorkdayConfig {
  type: 'workday';
  tenants: Array<{
    slug: string;       // e.g., "amazon"
    wd: string;         // e.g., "wd1"
    siteId: string;     // e.g., "amazonjobs"
    enabled: boolean;
  }>;
}

// Ashby: organization names
export interface AshbyConfig {
  type: 'ashby';
  orgs: Array<{
    name: string;       // e.g., "openai"
    enabled: boolean;
  }>;
}

// Lever: company slugs
export interface LeverConfig {
  type: 'lever';
  companies: Array<{
    slug: string;       // e.g., "stripe"
    name: string;       // e.g., "Stripe"
    enabled: boolean;
  }>;
}

// Union type for all adapter configs
export type AdapterConfig = 
  | GreenhouseConfig 
  | WorkdayConfig 
  | AshbyConfig 
  | LeverConfig;

// Default configurations
export const DEFAULT_CONFIGS: Record<string, AdapterConfig> = {
  greenhouse: {
    type: 'greenhouse',
    boards: [
      { token: 'stripe', name: 'Stripe', enabled: true },
      { token: 'figma', name: 'Figma', enabled: true },
      { token: 'notion', name: 'Notion', enabled: true },
    ],
  },
  workday: {
    type: 'workday',
    tenants: [
      { slug: 'amazon', wd: 'wd1', siteId: 'amazonjobs', enabled: true },
      { slug: 'microsoft', wd: 'wd1', siteId: 'mscareers', enabled: true },
      { slug: 'oracle', wd: 'wd5', siteId: 'oracle', enabled: true },
      { slug: 'sap', wd: 'wd5', siteId: 'sap', enabled: true },
      { slug: 'target', wd: 'wd1', siteId: 'target', enabled: true },
    ],
  },
  ashby: {
    type: 'ashby',
    orgs: [
      { name: 'openai', enabled: true },
      { name: 'anthropic', enabled: true },
      { name: 'cohere', enabled: true },
      { name: 'scaleai', enabled: true },
      { name: 'huggingface', enabled: true },
      { name: 'databricks', enabled: true },
      { name: 'perplexity', enabled: true },
      { name: 'cognition', enabled: true },
      { name: 'character-ai', enabled: true },
      { name: 'together', enabled: true },
      { name: 'mistral', enabled: true },
      { name: 'stability-ai', enabled: true },
      { name: 'weights-biases', enabled: true },
      { name: 'modal', enabled: true },
      { name: 'replit', enabled: true },
      { name: 'cursor', enabled: true },
      { name: 'sourcegraph', enabled: true },
    ],
  },
  lever: {
    type: 'lever',
    companies: [
      { slug: 'stripe', name: 'Stripe', enabled: true },
      { slug: 'figma', name: 'Figma', enabled: true },
      { slug: 'notion', name: 'Notion', enabled: true },
    ],
  },
};
