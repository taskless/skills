# Skill: Auth Login

## REMOVED Requirements

### Requirement: Auth login skill is informational

**Reason**: The standalone `taskless-login` skill is replaced by the consolidated `taskless` skill plus the `tskl help auth` recipe (which covers login, logout, and status in branches).

**Migration**: Login flow instructions move into `packages/cli/src/help/auth.txt` under the login branch.

### Requirement: Auth login skill has correct frontmatter

**Reason**: There is no longer a `taskless-login` skill file.

**Migration**: N/A.
