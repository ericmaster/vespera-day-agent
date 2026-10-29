// Source-grant model: the user decides, per source, what the agent may read.
// Default: everything OFF. Nothing is readable until explicitly granted.
export const SOURCE_KINDS = ['repo', 'email', 'chat', 'agent-transcript', 'ramblings', 'calendar', 'tasks', 'attention'];

export function createGrants(sources) {
  const granted = new Map(sources.map((s) => [s.id, false]));
  return {
    list: () => sources.map((s) => ({ id: s.id, kind: s.kind, label: s.label, granted: granted.get(s.id) })),
    set(id, on) {
      if (!granted.has(id)) throw new Error(`unknown source ${id}`);
      granted.set(id, !!on);
    },
    isGranted: (id) => granted.get(id) === true,
    grantedIds: () => [...granted].filter(([, v]) => v).map(([k]) => k),
  };
}
