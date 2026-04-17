export interface SkillDescriptor {
  name: string;
  optional: boolean;
}

export const SKILL_CATALOG: readonly SkillDescriptor[] = [
  { name: "taskless-check", optional: false },
  { name: "taskless-ci", optional: true },
  { name: "taskless-create-rule", optional: false },
  { name: "taskless-create-rule-anonymous", optional: false },
  { name: "taskless-delete-rule", optional: false },
  { name: "taskless-improve-rule", optional: false },
  { name: "taskless-improve-rule-anonymous", optional: false },
  { name: "taskless-info", optional: false },
  { name: "taskless-login", optional: false },
  { name: "taskless-logout", optional: false },
];

export function getMandatorySkillNames(): string[] {
  return SKILL_CATALOG.filter((s) => !s.optional).map((s) => s.name);
}

export function getOptionalSkillNames(): string[] {
  return SKILL_CATALOG.filter((s) => s.optional).map((s) => s.name);
}

export function isOptionalSkill(name: string): boolean {
  return SKILL_CATALOG.some((s) => s.name === name && s.optional);
}
