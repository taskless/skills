export interface SkillDescriptor {
  name: string;
  optional: boolean;
}

export const SKILL_CATALOG: readonly SkillDescriptor[] = [
  { name: "taskless", optional: false },
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
