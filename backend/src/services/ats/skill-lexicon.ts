/**
 * Curated baseline technical skill lexicon (E4.4 — ATS-K-001).
 *
 * In-repo, versioned. ~300 hard/technical + professional terms a resume author
 * is likely to list. Extension at scale is tracked by beads job-aggregator-l7q
 * (do not block v1). Terms are matched case-insensitively as substrings, so
 * prefer canonical / widely-spelled forms here.
 */
export const SKILL_LEXICON: string[] = [
  // --- Languages & runtimes ---
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'C', 'Go', 'Golang',
  'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'Dart', 'Perl', 'Elixir',
  'Clojure', 'Haskell', 'Lua', 'R', 'MATLAB', 'SQL', 'PL/SQL', 'NoSQL', 'GraphQL',
  'Bash', 'Shell', 'PowerShell', 'Node.js', 'Deno', 'Bun', '.NET', 'ASP.NET',
  'Express', 'Fastify', 'NestJS', 'Spring', 'Django', 'Flask', 'FastAPI', 'Rails',
  'Laravel', 'Symfony', 'Phoenix', 'gRPC', 'REST', 'WebSockets',
  // --- Frontend ---
  'React', 'React Native', 'Next.js', 'Nuxt', 'Vue', 'Vue.js', 'Angular', 'Svelte',
  'Redux', 'Zustand', 'MobX', 'jQuery', 'HTML', 'HTML5', 'CSS', 'CSS3', 'Sass',
  'SCSS', 'Less', 'Tailwind', 'Bootstrap', 'Material UI', 'MUI', 'Chakra UI',
  'Styled Components', 'Webpack', 'Vite', 'Rollup', 'Parcel', 'Babel', 'ESLint',
  'Prettier', 'Storybook', 'Cypress', 'Playwright', 'Jest', 'Vitest', 'Testing Library',
  'WebSockets', 'Service Workers', 'PWA', 'WebGL', 'Three.js', 'D3.js', 'Canvas',
  'Accessibility', 'WCAG', 'ARIA', 'Responsive Design', 'HMR',
  // --- Backend & services ---
  'REST API', 'GraphQL', 'MVC', 'Microservices', 'Event-Driven', 'Message Queue',
  'Redis', 'RabbitMQ', 'Kafka', 'NATS', 'BullMQ', 'CRON', 'Webhook', 'Serverless',
  'AWS Lambda', 'Azure Functions', 'Cloudflare Workers', 'Docker', 'Kubernetes', 'K8s',
  'Helm', 'Terraform', 'Ansible', 'Pulumi', 'CI/CD', 'GitHub Actions', 'GitLab CI',
  'Jenkins', 'CircleCI', 'Nginx', 'Caddy', 'Linux', 'Ubuntu', 'Nginx',
  // --- Data & databases ---
  'PostgreSQL', 'Postgres', 'MySQL', 'MariaDB', 'SQLite', 'MongoDB', 'Cassandra',
  'DynamoDB', 'Firebase', 'Supabase', 'Neon', 'PlanetScale', 'Prisma', 'TypeORM',
  'Sequelize', 'Knex', 'Mongoose', 'Drizzle', 'S3', 'MinIO', 'Elasticsearch',
  'OpenSearch', 'ClickHouse', 'Snowflake', 'BigQuery', 'Redshift', 'Databricks',
  'Spark', 'Hadoop', 'Pandas', 'NumPy', 'DuckDB', 'DataFusion', 'ETL', 'OLAP',
  'Data Pipeline', 'Streaming', 'Apache Airflow', 'dbt',
  // --- Cloud & infra ---
  'AWS', 'Amazon Web Services', 'EC2', 'ECS', 'EKS', 'S3', 'RDS', 'Lambda',
  'CloudFormation', 'IAM', 'VPC', 'Route 53', 'Azure', 'GCP', 'Google Cloud',
  'Google Cloud Platform', 'App Engine', 'Cloud Run', 'WebSockets',
  'Monitoring', 'Observability', 'Prometheus', 'Grafana', 'OpenObserve', 'Splunk',
  'Datadog', 'New Relic', 'Sentry', 'OpenTelemetry', 'Jaeger', 'Temporal',
  // --- AI/ML ---
  'Machine Learning', 'ML', 'Deep Learning', 'Neural Network', 'LLM', 'Prompt Engineering',
  'RAG', 'Vector Database', 'Embeddings', 'Fine-tuning', 'PyTorch', 'TensorFlow',
  'Keras', 'scikit-learn', 'XGBoost', 'LightGBM', 'OpenAI', 'Anthropic', 'Hugging Face',
  'Transformers', 'LangChain', 'GenAI', 'AI Agents', 'Orchestration', 'DAG',
  'Computer Vision', 'NLP', 'Natural Language Processing', 'Recommendation System',
  // --- Testing, quality & tooling ---
  'Unit Testing', 'Integration Testing', 'E2E Testing', 'TDD', 'Test-Driven Development',
  'CI', 'CD', 'Code Review', 'Linting', 'Type Safety', 'Profiling', 'Performance',
  'Core Web Vitals', 'LCP', 'INP', 'CLS', 'FID', 'Web Performance', 'Caching',
  'CDN', 'Load Testing', 'Security', 'OWASP', 'Auth', 'OAuth', 'JWT', 'SAML', 'SSO',
  'SOC 2', 'Encryption',
  // --- Professional / process ---
  'Agile', 'Scrum', 'Kanban', 'Lean', 'OKR', 'Architecture', 'System Design',
  'Scale', 'Mentoring', 'Cross-functional', 'Stakeholder', 'Roadmap', 'Technical Writing',
  'Documentation', 'Data-driven', 'A/B Testing', 'Analytics', 'Product',
].filter((v, i, a) => a.indexOf(v) === i) // de-dupe (no-op for curated list; safety)

/** Soft/transferable skills flagged separately for ATS-K-007 (hard vs soft). */
export const SOFT_SKILLS: string[] = [
  'Communication', 'Leadership', 'Teamwork', 'Collaboration', 'Problem-Solving',
  'Critical Thinking', 'Creativity', 'Adaptability', 'Time Management', 'Organization',
  'Detail-Oriented', 'Self-Starter', 'Stakeholder Management', 'Negotiation', 'Empathy',
  'Ownership', 'Initiative', 'Fast Learner', 'Cross-functional', 'Mentoring',
]