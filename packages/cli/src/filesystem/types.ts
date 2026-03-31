export type Migration = (directory: string) => Promise<void>;
export type Migrations = Record<string, Migration>;
