const STORAGE_KEY = 'lunchSchedulerTeams';

const DEFAULT_TEAMS = [
  { id: '1', name: 'Team 1', department: 'Import' },
  { id: '2', name: 'Team 2', department: 'Import' },
  { id: '3', name: 'Team 3', department: 'Import' },
  { id: '4', name: 'Team 4', department: 'Import' },
  { id: '5', name: 'Team 5', department: 'Import' },
  { id: '6', name: 'Team 1', department: 'Export' },
  { id: '7', name: 'Team 2', department: 'Export' },
  { id: '8', name: 'Team 1', department: 'Administration' },
  { id: '9', name: 'Team 2', department: 'Administration' },
  { id: '10', name: 'Team 3', department: 'Administration' },
];

export const loadTeams = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  // First run: seed defaults
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TEAMS));
  return DEFAULT_TEAMS;
};

export const saveTeams = (teams) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(teams));
};

export const addTeam = (name, department) => {
  const teams = loadTeams();
  const id = Date.now().toString();
  const updated = [...teams, { id, name, department }];
  saveTeams(updated);
  return updated;
};

export const editTeam = (id, name, department) => {
  const teams = loadTeams();
  const updated = teams.map(t => t.id === id ? { ...t, name, department } : t);
  saveTeams(updated);
  return updated;
};

export const removeTeam = (id) => {
  const teams = loadTeams();
  const updated = teams.filter(t => t.id !== id);
  saveTeams(updated);
  return updated;
};
