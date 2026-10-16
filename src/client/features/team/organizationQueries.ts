import { queryOptions, useQuery } from "@tanstack/react-query";
import { canSpend, hasOrgPermission } from "@/lib/org-permissions";
import { getOrganizationContext } from "@/serverFunctions/organization";

export const organizationContextQueryOptions = () =>
  queryOptions({
    queryKey: ["organization-context"],
    queryFn: () => getOrganizationContext(),
    staleTime: 60 * 1000,
  });

// True while loading: the sole-owner workspace is the overwhelmingly common
// case, and every billing surface is enforced server-side anyway — favor not
// flashing "ask your owner" at actual owners. This is a deliberate cosmetic
// choice, not an authorization gate; the server always re-checks billing:manage.
export function useCanManageBilling() {
  const { data } = useQuery(organizationContextQueryOptions());
  return data ? hasOrgPermission(data.role, { billing: ["manage"] }) : true;
}

// Same loading choice as useCanManageBilling: undefined until the context
// loads. The server gate (requireSpend) is the real enforcement.
export function useOrgRole(): string | undefined {
  const { data } = useQuery(organizationContextQueryOptions());
  return data?.role;
}

// True while the role is unknown, so owners never see a flash of the locked
// notice. Cosmetic only: every spending server function re-checks canSpend.
export function canSpendForRole(role: string | undefined): boolean {
  return role === undefined ? true : canSpend(role);
}

export function useCanSpend() {
  return canSpendForRole(useOrgRole());
}
