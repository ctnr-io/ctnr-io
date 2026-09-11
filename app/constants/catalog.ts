// Catalog presets shown in the dashboard "Catalog" browse view.
// Mirrors catalog/*/docker-compose.yaml (validated by catalog/catalog.test.ts on main).
// Kept as static data (not parsed from YAML at runtime) so the Expo bundle doesn't need
// a compose parser; core/transform/compose.ts stays the source of truth for the CLI.

export type CatalogEnvVar = {
  key: string
  value: string
}

export type CatalogPort = {
  port: string
  name: string
}

export type CatalogVolume = {
  name: string
  path: string
  size: string
}

export type CatalogEntry = {
  id: string
  name: string
  description: string
  image: string
  multiService: boolean
  env: CatalogEnvVar[]
  ports: CatalogPort[]
  volumes: CatalogVolume[]
  restart: 'always' | 'on-failure' | 'never'
}

export const CATALOG: CatalogEntry[] = [
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: 'PostgreSQL 16 relational database.',
    image: 'postgres:16',
    multiService: false,
    env: [
      { key: 'POSTGRES_USER', value: 'postgres' },
      { key: 'POSTGRES_PASSWORD', value: 'changeme' },
      { key: 'POSTGRES_DB', value: 'app' },
    ],
    ports: [{ port: '5432', name: 'postgres' }],
    volumes: [{ name: 'postgres-data', path: '/var/lib/postgresql/data', size: '10G' }],
    restart: 'always',
  },
  {
    id: 'n8n',
    name: 'n8n',
    description: 'Workflow automation platform.',
    image: 'docker.n8n.io/n8nio/n8n:latest',
    multiService: false,
    env: [
      { key: 'N8N_PROTOCOL', value: 'http' },
      { key: 'N8N_PORT', value: '5678' },
      { key: 'GENERIC_TIMEZONE', value: 'UTC' },
    ],
    ports: [{ port: '5678', name: 'n8n' }],
    volumes: [{ name: 'n8n-data', path: '/home/node/.n8n', size: '1G' }],
    restart: 'always',
  },
  {
    id: 'ghost',
    name: 'Ghost',
    description: 'Publishing platform (2 services: ghost + mysql). One-click deploy needs multi-service stack support.',
    image: 'ghost:5-alpine',
    multiService: true,
    env: [],
    ports: [],
    volumes: [],
    restart: 'always',
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Postgres + REST + auth stack (3 services). One-click deploy needs multi-service stack support.',
    image: 'supabase/postgres:15.1.0.117',
    multiService: true,
    env: [],
    ports: [],
    volumes: [],
    restart: 'always',
  },
]
