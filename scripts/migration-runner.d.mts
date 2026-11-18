export interface MigrationRunnerClient {
  query(
    queryText: string,
    values?: unknown[],
  ): Promise<{
    rows: Array<Record<string, unknown>>;
    rowCount: number | null;
  }>;
}

export interface DiscoveredMigration {
  version: string;
  versionNumber: number;
  filename: string;
  filePath: string;
  sql: string;
}

export function discoverMigrations(
  migrationsDirectory: string,
): Promise<DiscoveredMigration[]>;

export function runMigrations(
  client: MigrationRunnerClient,
  migrationsDirectory: string,
  options?: { log?: (message: string) => void },
): Promise<string[]>;
