# Skill: Auth Logout

## REMOVED Requirements

### Requirement: Auth logout skill is informational

**Reason**: The standalone `taskless-logout` skill is replaced by the consolidated `taskless` skill plus the `tskl help auth` recipe (which covers login, logout, and status in branches).

**Migration**: Logout flow instructions move into `packages/cli/src/help/auth.txt` under the logout branch.

### Requirement: Auth logout skill has correct frontmatter

**Reason**: There is no longer a `taskless-logout` skill file.

**Migration**: N/A.
