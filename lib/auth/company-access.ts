import { prisma } from "@/lib/db";

export type AccessFlags = {
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canApprove: boolean;
};

export type ResolvedUserCompanyAccess = {
  hasGlobalAccess: boolean;
  accessibleGroupIds: string[];
  accessibleCompanyIds: string[];
  companyAccess: Array<{ companyId: string; groupId: string } & AccessFlags>;
};

const noAccess: AccessFlags = { canView: false, canCreate: false, canUpdate: false, canDelete: false, canApprove: false };

function mergeAccess(left: AccessFlags, right: AccessFlags): AccessFlags {
  return {
    canView: left.canView || right.canView,
    canCreate: left.canCreate || right.canCreate,
    canUpdate: left.canUpdate || right.canUpdate,
    canDelete: left.canDelete || right.canDelete,
    canApprove: left.canApprove || right.canApprove,
  };
}

/** Resolves global, group and direct-company grants into one canonical company scope. */
export async function resolveUserCompanyAccess(userId: string): Promise<ResolvedUserCompanyAccess> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isSuperAdmin: true,
      hasGlobalGroupAccess: true,
      groupAccess: { select: { groupId: true, canView: true, canCreate: true, canUpdate: true, canDelete: true, canApprove: true } },
      companyAccess: { select: { companyId: true, canView: true, canCreate: true, canUpdate: true, canDelete: true, canApprove: true } },
    },
  });
  if (!user) return { hasGlobalAccess: false, accessibleGroupIds: [], accessibleCompanyIds: [], companyAccess: [] };

  const hasGlobalAccess = user.isSuperAdmin || user.hasGlobalGroupAccess;
  const groupGrants = new Map(user.groupAccess.filter((grant) => grant.canView).map((grant) => [grant.groupId, grant]));
  const directGrants = new Map(user.companyAccess.filter((grant) => grant.canView).map((grant) => [grant.companyId, grant]));
  const companies = await prisma.company.findMany({
    where: hasGlobalAccess
      ? {}
      : { OR: [{ groupId: { in: [...groupGrants.keys()] } }, { id: { in: [...directGrants.keys()] } }] },
    select: { id: true, groupId: true },
  });

  const entries = companies.map((company) => {
    const groupGrant = hasGlobalAccess ? { canView: true, canCreate: true, canUpdate: true, canDelete: true, canApprove: true } : groupGrants.get(company.groupId) ?? noAccess;
    const directGrant = directGrants.get(company.id) ?? noAccess;
    return { companyId: company.id, groupId: company.groupId, ...mergeAccess(groupGrant, directGrant) };
  });

  return {
    hasGlobalAccess,
    accessibleGroupIds: [...new Set(entries.map((entry) => entry.groupId))],
    accessibleCompanyIds: entries.filter((entry) => entry.canView).map((entry) => entry.companyId),
    companyAccess: entries.filter((entry) => entry.canView),
  };
}
