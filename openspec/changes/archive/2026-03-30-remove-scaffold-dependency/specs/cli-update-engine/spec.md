# CLI Update Engine

## REMOVED Requirements

### Requirement: Update-engine subcommand requests scaffold upgrade from backend

**Reason**: The backend is removing the `POST /cli/api/update-engine` and `GET /cli/api/update-engine/:requestId` endpoints. The scaffold is no longer backend-managed.

**Migration**: Remove the `update-engine` command, its help file, the `update-api.ts` action, and the associated skill (`taskless-update-engine`).

### Requirement: Update-engine command supports JSON output

**Reason**: Command is being removed entirely.

**Migration**: No replacement needed.

### Requirement: Update-engine command polls until PR is created

**Reason**: Command is being removed entirely.

**Migration**: No replacement needed.

### Requirement: Update-engine command is non-blocking after PR creation

**Reason**: Command is being removed entirely.

**Migration**: No replacement needed.

### Requirement: Update-engine request endpoint accepts project info and returns status

**Reason**: Backend endpoint is being decommissioned as part of TSKL-212.

**Migration**: No CLI-side replacement. The backend team handles endpoint removal.

### Requirement: Update-engine status endpoint returns job progress

**Reason**: Backend endpoint is being decommissioned as part of TSKL-212.

**Migration**: No CLI-side replacement.

### Requirement: Update-engine API supports schema introspection

**Reason**: Backend endpoint is being decommissioned as part of TSKL-212.

**Migration**: No CLI-side replacement.
