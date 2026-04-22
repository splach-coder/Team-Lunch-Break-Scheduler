import React, { useState, useEffect } from 'react';
import {
  Clock, Users, CheckCircle, AlertTriangle, Download, Copy,
  LogIn, LogOut, Lock, Eye, Pencil, Trash2
} from 'lucide-react';
import {
  fetchMembers,
  updateSchedule,
  createSchedule,
  deleteSchedule,
  createMember,
  updateMember,
  deleteMember,
  fetchScheduleByDay,
  fetchTeams,
  createTeam,
  updateTeam,
  deleteTeam,
} from './airtable';

const buildTeamStructure = (membersData) => {
  const colors = [
    'bg-blue-100 text-blue-800 border-blue-200',
    'bg-green-100 text-green-800 border-green-200',
    'bg-purple-100 text-purple-800 border-purple-200',
    'bg-orange-100 text-orange-800 border-orange-200',
    'bg-pink-100 text-pink-800 border-pink-200',
    'bg-red-100 text-red-800 border-red-200',
    'bg-indigo-100 text-indigo-800 border-indigo-200',
    'bg-teal-100 text-teal-800 border-teal-200',
    'bg-amber-100 text-amber-800 border-amber-200'
  ];
  const structure = {};
  membersData.forEach(member => {
    if (!member.bigTeam || !member.team || !member.name) return;
    if (!structure[member.bigTeam]) structure[member.bigTeam] = [];
    const existingTeam = structure[member.bigTeam].find(t => t.name === member.team);
    if (existingTeam) {
      existingTeam.members.push(member.name);
    } else {
      structure[member.bigTeam].push({
        id: `${member.bigTeam}-${member.team}`,
        name: member.team,
        members: [member.name],
        color: colors[structure[member.bigTeam].length % colors.length]
      });
    }
  });
  return structure;
};

const MemberCard = ({ member, onDragStart, onEdit, onDelete, deleting }) => (
  <div
    draggable
    onDragStart={e => onDragStart(e, member)}
    className="flex items-center justify-between bg-white border border-gray-200 rounded-md px-2 py-1.5 cursor-grab active:cursor-grabbing shadow-sm group"
  >
    <span className="text-xs font-medium text-gray-800 truncate flex-1">{member.name}</span>
    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
      <button
        onClick={e => { e.stopPropagation(); onEdit(); }}
        className="p-0.5 text-blue-500 hover:text-blue-700 rounded"
        title="Edit name"
      >
        <Pencil className="w-3 h-3" />
      </button>
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        disabled={deleting}
        className="p-0.5 text-red-500 hover:text-red-700 rounded disabled:opacity-40"
        title="Delete member"
      >
        {deleting ? <span className="text-xs">…</span> : <Trash2 className="w-3 h-3" />}
      </button>
    </div>
  </div>
);

const App = () => {
  const timeSlots = [
    { id: '1', time: '12:00–13:00', start: '12:00', end: '13:00' },
    { id: '2', time: '13:00–14:00', start: '13:00', end: '14:00' },
    { id: '3', time: '14:00–15:00', start: '14:00', end: '15:00' }
  ];
  const fridayTimeSlots = [
    { id: '1', time: '12:30–13:30', start: '12:30', end: '13:30' },
    { id: '2', time: '13:30–14:30', start: '13:30', end: '14:30' },
    { id: '3', time: '14:30–15:30', start: '14:30', end: '15:30' }
  ];

  // Special constraints - now based on team data
  const specialConstraints = {
    conflictGroups: [
      ['Sanaa', 'Fadwa'], // Can't be in same time slot
      ['Mehdi', 'Hamza'], // Can't be in same time slot
      ['Salma', 'Fatima zahra ben', 'Fatima zahra Her'], // HR team can't be together
    ],
    soloRequirements: [
      { person: 'Sanaa', team: 'Team 2' }, // Must be alone from Team 2
      { person: 'Fadwa', team: 'Team 3' },  // Must be alone from Team 3
      { person: 'Fatima zahra ben', team: 'Team 3' }      // HR must be alone
    ]
  };

  // State
  const [members, setMembers] = useState([]);
  const [schedule, setSchedule] = useState({ 1: [], 2: [], 3: [] });
  const [teamStructure, setTeamStructure] = useState({});
  const [draggedPerson, setDraggedPerson] = useState(null);
  const [showMessage, setShowMessage] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [selectedBigTeam, setSelectedBigTeam] = useState('');
  const [teams, setTeams] = useState([]);
  const [newTeam, setNewTeam] = useState({ name: '', department: '' });
  const [addTeamError, setAddTeamError] = useState('');
  const [editingTeam, setEditingTeam] = useState(null);
  const [editTeamData, setEditTeamData] = useState({ name: '', department: '' });
  const [editTeamError, setEditTeamError] = useState('');
  const [savingTeam, setSavingTeam] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newMember, setNewMember] = useState({ name: '', team: '', bigTeam: '' });
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState('');
  const [fridaySchedule, setFridaySchedule] = useState({ 1: [], 2: [], 3: [] });
  const [editingMember, setEditingMember] = useState(null);
  const [editMemberData, setEditMemberData] = useState({ name: '', team: '', bigTeam: '' });
  const [editMemberError, setEditMemberError] = useState('');
  const [savingMember, setSavingMember] = useState(false);
  const [deletingMemberId, setDeletingMemberId] = useState(null);
  const [draggingMember, setDraggingMember] = useState(null);
  const [memberDropTarget, setMemberDropTarget] = useState(null);

  // Initialize data from Airtable
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch members and schedules
        const [membersData, scheduleData, fridayScheduleData] = await Promise.all([
          fetchMembers(),
          fetchScheduleByDay('Mon–Thu'),
          fetchScheduleByDay('Friday'),
        ]);

        setMembers(membersData);

        // Load teams from Airtable; seed defaults on first run
        let teamsData = await fetchTeams();
        if (teamsData.length === 0) {
          const defaults = [
            { name: 'Team 1', department: 'Import' },
            { name: 'Team 2', department: 'Import' },
            { name: 'Team 3', department: 'Import' },
            { name: 'Team 4', department: 'Import' },
            { name: 'Team 5', department: 'Import' },
            { name: 'Team 1', department: 'Export' },
            { name: 'Team 2', department: 'Export' },
            { name: 'Team 3', department: 'Export' },
            { name: 'Team 1', department: 'Administration' },
            { name: 'Team 2', department: 'Administration' },
            { name: 'Team 3', department: 'Administration' },
          ];
          const created = await Promise.all(defaults.map(t => createTeam(t.name, t.department)));
          teamsData = created.map((r, i) => ({ id: r.id, name: defaults[i].name, department: defaults[i].department }));
        }
        setTeams(teamsData);

        // Set initial department selection
        const firstDept = [...new Set(teamsData.map(t => t.department).filter(Boolean))][0];
        if (firstDept) setSelectedBigTeam(firstDept);

        // Organize Mon–Thu schedule by time slot
        const newSchedule = { 1: [], 2: [], 3: [] };
        scheduleData.forEach(item => {
          if (item.timeSlot && newSchedule[item.timeSlot]) {
            newSchedule[item.timeSlot].push({
              id: item.id,
              name: item.memberName,
              memberId: item.memberId
            });
          }
        });
        setSchedule(newSchedule);

        // Organize Friday schedule by time slot
        const newFridaySchedule = { 1: [], 2: [], 3: [] };
        fridayScheduleData.forEach(item => {
          if (item.timeSlot && newFridaySchedule[item.timeSlot]) {
            newFridaySchedule[item.timeSlot].push({
              id: item.id,
              name: item.memberName,
              memberId: item.memberId
            });
          }
        });
        setFridaySchedule(newFridaySchedule);

        setTeamStructure(buildTeamStructure(membersData));

      } catch (error) {
        console.error('Error loading data:', error);
        setError('Failed to load data. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Check if user was previously logged in
  useEffect(() => {
    const savedAuth = localStorage.getItem('lunchSchedulerAuth');
    if (savedAuth) {
      setIsAdmin(true);
    }
  }, []);

  // Dynamic team helpers — sourced from the Teams Table
  const getDepartments = () => [...new Set(teams.map(t => t.department).filter(Boolean))];
  const getTeamsForDepartment = (dept) => teams.filter(t => t.department === dept).map(t => t.name);

  // Get all sub-teams for the selected big team — only teams that exist in localStorage
  const getCurrentSubTeams = () => {
    const validNames = getTeamsForDepartment(selectedBigTeam);
    return (teamStructure[selectedBigTeam] || []).filter(t => validNames.includes(t.name));
  };

  // Departments come only from localStorage teams (single source of truth)
  const getBigTeamNames = () => getDepartments();

  // Get people in the selected big team
  const getCurrentPeople = () => {
    return getCurrentSubTeams().flatMap(team => team.members);
  };

  const getPersonTeam = (personName) => {
    for (const bigTeam in teamStructure) {
      const foundTeam = teamStructure[bigTeam].find(team => team.members.includes(personName));
      if (foundTeam) {
        return {
          ...foundTeam,
          bigTeam: bigTeam
        };
      }
    }
    return null;
  };

  // Filter schedule to only show people from the selected big team
  const getFilteredSchedule = () => {
    const currentPeople = getCurrentPeople();
    const filteredSchedule = {};
    
    Object.keys(schedule).forEach(slotId => {
      filteredSchedule[slotId] = schedule[slotId].filter(person => 
        currentPeople.includes(person.name)
      );
    });
    
    return filteredSchedule;
  };

  // Helper for Friday schedule
  const getFilteredFridaySchedule = () => {
    const currentPeople = getCurrentPeople();
    const filteredSchedule = {};
    Object.keys(fridaySchedule).forEach(slotId => {
      filteredSchedule[slotId] = fridaySchedule[slotId].filter(person => 
        currentPeople.includes(person.name)
      );
    });
    return filteredSchedule;
  };

  const getTeamConstraintStatus = () => {
    const violations = [];
    const warnings = [];
    const currentPeople = getCurrentPeople();
    const filteredSchedule = getFilteredSchedule();
   
    // Check basic team constraints
    Object.keys(filteredSchedule).forEach(slotId => {
      const teamCounts = {};
      filteredSchedule[slotId].forEach(person => {
        const team = getPersonTeam(person.name);
        if (team) {
          teamCounts[team.id] = (teamCounts[team.id] || 0) + 1;
        }
      });
     
      Object.entries(teamCounts).forEach(([teamId, count]) => {
        const team = getCurrentSubTeams().find(t => t.id === teamId);
        if (team && count > 2) {
          violations.push(`${team.name} has ${count} people in slot ${slotId} (max 2 allowed)`);
        } else if (team && count === 2) {
          warnings.push(`${team.name} has 2 people in slot ${slotId} (prefer 1)`);
        }
      });
    });

    // Check conflict groups (people who can't be in same slot)
    specialConstraints.conflictGroups.forEach(group => {
      const relevantGroup = group.filter(person => currentPeople.includes(person));
      if (relevantGroup.length < 2) return;
      
      Object.keys(filteredSchedule).forEach(slotId => {
        const conflictsInSlot = relevantGroup.filter(person => 
          filteredSchedule[slotId].some(p => p.name === person)
        );
        if (conflictsInSlot.length > 1) {
          violations.push(`Conflict: ${conflictsInSlot.join(', ')} cannot be in the same time slot (${timeSlots.find(s => s.id.toString() === slotId)?.time})`);
        }
      });
    });

    // Check solo requirements
    specialConstraints.soloRequirements.forEach(({ person, team }) => {
      if (!currentPeople.includes(person)) return;
      
      Object.keys(filteredSchedule).forEach(slotId => {
        if (filteredSchedule[slotId].some(p => p.name === person)) {
          const teamMatesInSlot = filteredSchedule[slotId].filter(p => {
            const pTeam = getPersonTeam(p.name);
            return pTeam && pTeam.name === team && p.name !== person;
          });
          if (teamMatesInSlot.length > 0) {
            violations.push(`${person} must be alone from ${team} but is with: ${teamMatesInSlot.map(p => p.name).join(', ')}`);
          }
        }
      });
    });
   
    return { violations, warnings };
  };

  const getScheduledPeople = () => {
    return Object.values(getFilteredSchedule()).flat();
  };

  const getUnscheduledPeople = () => {
    const allPeople = getCurrentPeople();
    const scheduledPeople = getScheduledPeople().map(p => p.name);
    return allPeople.filter(person => !scheduledPeople.includes(person));
  };

  const getScheduledFridayPeople = () => {
    return Object.values(getFilteredFridaySchedule()).flat();
  };

  const getUnscheduledFridayPeople = () => {
    const allPeople = getCurrentPeople();
    const scheduledPeople = getScheduledFridayPeople().map(p => p.name);
    return allPeople.filter(person => !scheduledPeople.includes(person));
  };

  const handleDragStart = (e, person, fromSlot = null) => {
    if (!isAdmin) return;
    setDraggedPerson({ person, fromSlot });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    if (!isAdmin) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, toSlot) => {
    if (!isAdmin) return;
    e.preventDefault();
    if (!draggedPerson) return;

    const { person, fromSlot } = draggedPerson;
    
    try {
      let result;
      if (fromSlot) {
        // Update the existing schedule entry instead of deleting and creating
        result = await updateSchedule(person.id, toSlot);
        if (result.success) {
          setSchedule(prev => {
            const newSchedule = { ...prev };
            // Remove from original slot
            newSchedule[fromSlot] = newSchedule[fromSlot].filter(p => p.id !== person.id);
            // Add to new slot
            newSchedule[toSlot] = [
              ...newSchedule[toSlot],
              {
                id: person.id,
                name: person.name,
                memberId: person.memberId
              }
            ];
            return newSchedule;
          });
        }
      } else {
        // Create new schedule entry for unscheduled person
        result = await createSchedule(person.memberId, toSlot);
        if (result.success) {
          setSchedule(prev => {
            const newSchedule = { ...prev };
            newSchedule[toSlot] = [
              ...newSchedule[toSlot],
              {
                id: result.id,
                name: person.name,
                memberId: person.memberId
              }
            ];
            return newSchedule;
          });
        }
      }
    } catch (error) {
      console.error('Error updating schedule:', error);
      alert('Failed to update schedule. Please try again.');
    } finally {
      setDraggedPerson(null);
    }
  };

  // Drag-and-drop for Friday
  const handleFridayDrop = async (e, toSlot) => {
    if (!isAdmin) return;
    e.preventDefault();
    if (!draggedPerson) return;
    const { person, fromSlot } = draggedPerson;
    try {
      let result;
      if (fromSlot) {
        // Update the existing schedule entry for Friday
        result = await updateSchedule(person.id, toSlot, 'Friday');
        if (result.success) {
          setFridaySchedule(prev => {
            const newSchedule = { ...prev };
            newSchedule[fromSlot] = newSchedule[fromSlot].filter(p => p.id !== person.id);
            newSchedule[toSlot] = [
              ...newSchedule[toSlot],
              {
                id: person.id,
                name: person.name,
                memberId: person.memberId
              }
            ];
            return newSchedule;
          });
        }
      } else {
        // Create new schedule entry for unscheduled person for Friday
        result = await createSchedule(person.memberId, toSlot, 'Friday');
        if (result.success) {
          setFridaySchedule(prev => {
            const newSchedule = { ...prev };
            newSchedule[toSlot] = [
              ...newSchedule[toSlot].filter(p => p.memberId !== person.memberId),
              {
                id: result.id, // Use the Airtable record ID
                name: person.name,
                memberId: person.memberId
              }
            ];
            return newSchedule;
          });
        }
      }
    } catch (error) {
      console.error('Error updating Friday schedule:', error);
      alert('Failed to update Friday schedule. Please try again.');
    } finally {
      setDraggedPerson(null);
    }
  };


  const generateMessage = () => {
    const constraints = getTeamConstraintStatus();
    const unscheduled = getUnscheduledPeople();
    const filteredSchedule = getFilteredSchedule();
   
    if (constraints.violations.length > 0 || unscheduled.length > 0) {
      alert('Please fix constraint violations and schedule all team members before generating the message.');
      return;
    }
   
    setShowMessage(true);
  };

  const copyMessage = () => {
    const filteredSchedule = getFilteredSchedule();
    const message = `Hello ${selectedBigTeam} team 👋, Here's the lunch break schedule. Everyone has 1 hour. Please respect your assigned time with maximum 15 minutes of delay. If any issue arises, let me know. Thanks!

${timeSlots.map(slot =>
  `${slot.time}:\n${filteredSchedule[slot.id].map(person => `• ${person.name}`).join('\n')}`
).join('\n\n')}`;
   
    navigator.clipboard.writeText(message);
    alert('Message copied to clipboard!');
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (loginData.username === 'admin' && loginData.password === 'admin123') {
      setIsAdmin(true);
      setLoginOpen(false);
      setLoginError('');
      localStorage.setItem('lunchSchedulerAuth', 'true');
    } else {
      setLoginError('Invalid credentials.');
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem('lunchSchedulerAuth');
  };


  const constraints = getTeamConstraintStatus();
  const unscheduledPeople = getUnscheduledPeople();
  const filteredSchedule = getFilteredSchedule();

  // Add member handler
  const handleAddMember = async (e) => {
    e.preventDefault();
    setAddingMember(true);
    setAddMemberError('');
    if (!newMember.name) {
      setAddMemberError('Name is required.');
      setAddingMember(false);
      return;
    }
    try {
      const result = await createMember(newMember.name, newMember.team, newMember.bigTeam || selectedBigTeam);
      if (result.success) {
        const membersData = await fetchMembers();
        setMembers(membersData);
        setTeamStructure(buildTeamStructure(membersData));
        setNewMember({ name: '', team: '', bigTeam: '' });
      } else {
        setAddMemberError('Failed to add member.');
      }
    } catch (error) {
      setAddMemberError('Failed to add member.');
    } finally {
      setAddingMember(false);
    }
  };

  // Dynamic dropdown options built from Teams Table
  const bigTeamOptions = getDepartments().map(dep => ({ value: dep, label: dep }));
  const addMemberTeamOptions = getTeamsForDepartment(newMember.bigTeam || selectedBigTeam);

  const handleDeleteMember = async (member) => {
    if (!window.confirm(`Delete ${member.name}? This will also remove them from all schedules.`)) return;
    setDeletingMemberId(member.id);
    try {
      // Collect all their schedule entries across both schedules
      const allEntries = [
        ...Object.values(schedule).flat(),
        ...Object.values(fridaySchedule).flat()
      ].filter(p => p.memberId === member.id);

      await Promise.all(allEntries.map(entry => deleteSchedule(entry.id)));
      const result = await deleteMember(member.id);

      if (result.success) {
        const newMembers = members.filter(m => m.id !== member.id);
        setMembers(newMembers);
        setTeamStructure(buildTeamStructure(newMembers));
        setSchedule(prev => {
          const updated = {};
          Object.keys(prev).forEach(slot => {
            updated[slot] = prev[slot].filter(p => p.memberId !== member.id);
          });
          return updated;
        });
        setFridaySchedule(prev => {
          const updated = {};
          Object.keys(prev).forEach(slot => {
            updated[slot] = prev[slot].filter(p => p.memberId !== member.id);
          });
          return updated;
        });
      } else {
        alert('Failed to delete member.');
      }
    } catch (error) {
      alert('Failed to delete member.');
    } finally {
      setDeletingMemberId(null);
    }
  };

  const handleSaveMember = async (e) => {
    e.preventDefault();
    if (!editMemberData.name) {
      setEditMemberError('Name is required.');
      return;
    }
    // Preserve existing team — team assignment is done via drag-and-drop
    editMemberData.team = editingMember.team || '';
    setSavingMember(true);
    setEditMemberError('');
    try {
      const result = await updateMember(editingMember.id, editMemberData.name, editMemberData.team, editMemberData.bigTeam);
      if (result.success) {
        const newMembers = members.map(m =>
          m.id === editingMember.id
            ? { ...m, name: editMemberData.name, team: editMemberData.team, bigTeam: editMemberData.bigTeam }
            : m
        );
        setMembers(newMembers);
        setTeamStructure(buildTeamStructure(newMembers));

        // If the name changed, update it in both schedule states
        if (editMemberData.name !== editingMember.name) {
          const applyNameUpdate = (sched) => {
            const updated = {};
            Object.keys(sched).forEach(slot => {
              updated[slot] = sched[slot].map(p =>
                p.memberId === editingMember.id ? { ...p, name: editMemberData.name } : p
              );
            });
            return updated;
          };
          setSchedule(prev => applyNameUpdate(prev));
          setFridaySchedule(prev => applyNameUpdate(prev));
        }
        setEditingMember(null);
      } else {
        setEditMemberError('Failed to update member.');
      }
    } catch (error) {
      setEditMemberError('Failed to update member.');
    } finally {
      setSavingMember(false);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeam.name) {
      setAddTeamError('Team name is required.');
      return;
    }
    setSavingTeam(true);
    setAddTeamError('');
    try {
      const result = await createTeam(newTeam.name, selectedBigTeam);
      if (result.success) {
        setTeams(prev => [...prev, { id: result.id, name: newTeam.name, department: selectedBigTeam }]);
        setNewTeam({ name: '', department: '' });
      } else {
        setAddTeamError('Failed to create team.');
      }
    } catch {
      setAddTeamError('Failed to create team.');
    } finally {
      setSavingTeam(false);
    }
  };

  const handleUpdateTeam = async (e) => {
    e.preventDefault();
    if (!editTeamData.name || !editTeamData.department) {
      setEditTeamError('All fields are required.');
      return;
    }
    const oldName = editingTeam.name;
    const oldDept = editingTeam.department;
    const newName = editTeamData.name;
    const newDept = editTeamData.department;

    // Update in Airtable
    setSavingTeam(true);
    try {
      await updateTeam(editingTeam.id, newName, newDept);
    } catch {
      setEditTeamError('Failed to update team.');
      setSavingTeam(false);
      return;
    }
    setSavingTeam(false);
    setTeams(prev => prev.map(t => t.id === editingTeam.id ? { ...t, name: newName, department: newDept } : t));
    setEditingTeam(null);
    setEditTeamError('');

    // If name or department changed, update all affected members in Airtable
    if (oldName !== newName || oldDept !== newDept) {
      const affected = members.filter(m => m.team === oldName && m.bigTeam === oldDept);
      if (affected.length > 0) {
        await Promise.all(affected.map(m => updateMember(m.id, m.name, newName, newDept)));
        const newMembers = members.map(m =>
          m.team === oldName && m.bigTeam === oldDept
            ? { ...m, team: newName, bigTeam: newDept }
            : m
        );
        setMembers(newMembers);
        setTeamStructure(buildTeamStructure(newMembers));
      }
    }
  };

  const handleDeleteTeam = async (team) => {
    const affected = members.filter(m => m.team === team.name && m.bigTeam === team.department);
    const msg = affected.length > 0
      ? `Delete team "${team.name}"? ${affected.length} member(s) will have their team cleared.`
      : `Delete team "${team.name}"?`;
    if (!window.confirm(msg)) return;

    // Remove from Airtable
    await deleteTeam(team.id);
    setTeams(prev => prev.filter(t => t.id !== team.id));

    // Clear team assignment on affected members in Airtable
    if (affected.length > 0) {
      await Promise.all(affected.map(m => updateMember(m.id, m.name, '', m.bigTeam)));
      const newMembers = members.map(m =>
        m.team === team.name && m.bigTeam === team.department
          ? { ...m, team: '' }
          : m
      );
      setMembers(newMembers);
      setTeamStructure(buildTeamStructure(newMembers));
    }
  };

  const handleMemberDragStart = (e, member) => {
    setDraggingMember(member);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleTeamDrop = async (e, teamName) => {
    e.preventDefault();
    setMemberDropTarget(null);
    if (!draggingMember || draggingMember.team === teamName) { setDraggingMember(null); return; }
    const result = await updateMember(draggingMember.id, draggingMember.name, teamName, draggingMember.bigTeam || selectedBigTeam);
    if (result.success) {
      const newMembers = members.map(m =>
        m.id === draggingMember.id ? { ...m, team: teamName, bigTeam: draggingMember.bigTeam || selectedBigTeam } : m
      );
      setMembers(newMembers);
      setTeamStructure(buildTeamStructure(newMembers));
    }
    setDraggingMember(null);
  };

  const handleUnassignedDrop = async (e) => {
    e.preventDefault();
    setMemberDropTarget(null);
    if (!draggingMember) return;
    const result = await updateMember(draggingMember.id, draggingMember.name, '', draggingMember.bigTeam || selectedBigTeam);
    if (result.success) {
      const newMembers = members.map(m =>
        m.id === draggingMember.id ? { ...m, team: '' } : m
      );
      setMembers(newMembers);
      setTeamStructure(buildTeamStructure(newMembers));
    }
    setDraggingMember(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-white">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Clock className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Team Lunch Break Scheduler</h1>
        </div>
        <div className="flex gap-2">
          {isAdmin ? (
            <>
              <select
                value={selectedBigTeam}
                onChange={(e) => setSelectedBigTeam(e.target.value)}
                className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-2"
              >
                {getBigTeamNames().map(bigTeam => (
                  <option key={bigTeam} value={bigTeam}>{bigTeam}</option>
                ))}
              </select>
              <button
                onClick={generateMessage}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <Download className="w-4 h-4" />
                Generate Message
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <select
                value={selectedBigTeam}
                onChange={(e) => setSelectedBigTeam(e.target.value)}
                className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-2"
              >
                {getBigTeamNames().map(bigTeam => (
                  <option key={bigTeam} value={bigTeam}>{bigTeam}</option>
                ))}
              </select>
              <button
                onClick={() => setLoginOpen(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <LogIn className="w-4 h-4" />
                Admin Login
              </button>
              <div className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg">
                <Eye className="w-4 h-4" />
                View Mode
              </div>
            </>
          )}
        </div>
      </div>

      {/* Login Modal */}
      {loginOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Admin Login
            </h2>
            <form onSubmit={handleLogin}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Username</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={loginData.username}
                  onChange={(e) => setLoginData({...loginData, username: e.target.value})}
                  placeholder=""
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={loginData.password}
                  onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                  placeholder=""
                />
              </div>
              {loginError && <div className="text-red-500 mb-4">{loginError}</div>}
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  <LogIn className="w-4 h-4" />
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => setLoginOpen(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin-only Teams & Members management */}
      {isAdmin && (
        <>
        {/* Manage Teams */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-purple-900 mb-3">Manage Teams — {selectedBigTeam}</h3>
          {/* Create team form — department locked to selected */}
          <form className="flex flex-col md:flex-row gap-2 items-start md:items-end mb-4" onSubmit={handleCreateTeam}>
            <div>
              <label className="block text-xs text-gray-700 mb-1">Team Name</label>
              <input
                type="text"
                className="px-2 py-1 border rounded"
                placeholder="e.g. Team 1"
                value={newTeam.name}
                onChange={e => setNewTeam({ ...newTeam, name: e.target.value, department: selectedBigTeam })}
                required
              />
            </div>
            <button
              type="submit"
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
            >
              Add Team
            </button>
          </form>
          {addTeamError && <div className="text-red-600 text-sm mb-3">{addTeamError}</div>}

          {/* Teams list — only current department */}
          {teams.filter(t => t.department === selectedBigTeam).length === 0 ? (
            <p className="text-purple-700 text-sm">No teams yet for {selectedBigTeam}. Add one above.</p>
          ) : (
            <div className="space-y-1">
              {teams.filter(t => t.department === selectedBigTeam).map(team => (
                <div key={team.id} className="flex items-center justify-between bg-white border border-purple-100 rounded-lg px-3 py-2">
                  <span className="text-sm font-medium text-gray-800">{team.name}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setEditingTeam(team); setEditTeamData({ name: team.name, department: team.department }); setEditTeamError(''); }}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                      title="Edit team"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTeam(team)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      title="Delete team"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-green-900 mb-2">Add New Member</h3>
          <form className="flex flex-col md:flex-row gap-2 items-start md:items-end" onSubmit={handleAddMember}>
            <div>
              <label className="block text-xs text-gray-700 mb-1">Name</label>
              <input
                type="text"
                className="px-2 py-1 border rounded"
                value={newMember.name}
                onChange={e => setNewMember({ ...newMember, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1">Department</label>
              <select
                className="px-2 py-1 border rounded"
                value={newMember.bigTeam || selectedBigTeam}
                onChange={e => setNewMember({ ...newMember, bigTeam: e.target.value, team: '' })}
              >
                <option value="">— optional —</option>
                {bigTeamOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1">Team</label>
              <select
                className="px-2 py-1 border rounded"
                value={newMember.team}
                onChange={e => setNewMember({ ...newMember, team: e.target.value })}
              >
                <option value="">Select team</option>
                {addMemberTeamOptions.map(team => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
              disabled={addingMember}
            >
              {addingMember ? 'Adding...' : 'Add Member'}
            </button>
          </form>
          {addMemberError && <div className="text-red-600 mt-2 text-sm">{addMemberError}</div>}
        </div>

        {/* Members Kanban — drag members onto team columns */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-1">
            {selectedBigTeam} Members ({members.filter(m => m.bigTeam === selectedBigTeam).length})
          </h3>
          <p className="text-xs text-gray-400 mb-4">Drag a member card onto a team column to assign them.</p>

          <div className="flex gap-3 overflow-x-auto pb-2">
            {/* Unassigned column */}
            {(() => {
              const unassigned = members.filter(m => m.bigTeam === selectedBigTeam && !m.team);
              const isTarget = memberDropTarget === '__unassigned__';
              return (
                <div
                  key="unassigned"
                  className={`flex-shrink-0 w-40 rounded-lg border-2 border-dashed p-2 transition-colors ${isTarget ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-gray-50'}`}
                  onDragOver={e => { e.preventDefault(); setMemberDropTarget('__unassigned__'); }}
                  onDragLeave={() => setMemberDropTarget(null)}
                  onDrop={handleUnassignedDrop}
                >
                  <p className="text-xs font-semibold text-yellow-700 mb-2 truncate">Unassigned</p>
                  <div className="space-y-1 min-h-[60px]">
                    {unassigned.map(member => (
                      <MemberCard
                        key={member.id}
                        member={member}
                        onDragStart={handleMemberDragStart}
                        onEdit={() => { setEditingMember(member); setEditMemberData({ name: member.name, team: '', bigTeam: member.bigTeam || '' }); setEditMemberError(''); }}
                        onDelete={() => handleDeleteMember(member)}
                        deleting={deletingMemberId === member.id}
                      />
                    ))}
                    {unassigned.length === 0 && <p className="text-xs text-gray-300 text-center pt-2">empty</p>}
                  </div>
                </div>
              );
            })()}

            {/* One column per team */}
            {getTeamsForDepartment(selectedBigTeam).map((teamName, idx) => {
              const colors = [
                'border-blue-300 bg-blue-50', 'border-green-300 bg-green-50',
                'border-purple-300 bg-purple-50', 'border-orange-300 bg-orange-50',
                'border-pink-300 bg-pink-50', 'border-red-300 bg-red-50',
                'border-indigo-300 bg-indigo-50', 'border-teal-300 bg-teal-50',
              ];
              const headerColors = [
                'text-blue-700', 'text-green-700', 'text-purple-700',
                'text-orange-700', 'text-pink-700', 'text-red-700',
                'text-indigo-700', 'text-teal-700',
              ];
              const isTarget = memberDropTarget === teamName;
              const teamMembers = members.filter(m => m.bigTeam === selectedBigTeam && m.team === teamName);
              return (
                <div
                  key={teamName}
                  className={`flex-shrink-0 w-40 rounded-lg border-2 p-2 transition-colors ${isTarget ? 'border-blue-500 bg-blue-100' : colors[idx % colors.length]}`}
                  onDragOver={e => { e.preventDefault(); setMemberDropTarget(teamName); }}
                  onDragLeave={() => setMemberDropTarget(null)}
                  onDrop={e => handleTeamDrop(e, teamName)}
                >
                  <p className={`text-xs font-semibold mb-2 truncate ${headerColors[idx % headerColors.length]}`}>{teamName}</p>
                  <div className="space-y-1 min-h-[60px]">
                    {teamMembers.map(member => (
                      <MemberCard
                        key={member.id}
                        member={member}
                        onDragStart={handleMemberDragStart}
                        onEdit={() => { setEditingMember(member); setEditMemberData({ name: member.name, team: member.team || '', bigTeam: member.bigTeam || '' }); setEditMemberError(''); }}
                        onDelete={() => handleDeleteMember(member)}
                        deleting={deletingMemberId === member.id}
                      />
                    ))}
                    {teamMembers.length === 0 && <p className="text-xs text-gray-300 text-center pt-2">empty</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </>
      )}

      {/* Admin-only panels */}
      {isAdmin && (
        <>
          {/* Special Constraints Panel */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-3">Special Constraints for {selectedBigTeam}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <strong className="text-blue-900">Conflict Groups:</strong>
                <div className="ml-2 text-blue-700">
                  {selectedBigTeam === 'Import' && (
                    <>
                      • Sanaa, Fadwa, Zohra cannot be in same slot<br/>
                      • Mehdi and Hamza cannot be in same slot<br/>
                    </>
                  )}
                  {selectedBigTeam === 'Administration' && (
                    <>
                      • Fatima zahra ben and Fatima zahra Her and Salma cannot be together<br/>
                    </>
                  )}
                </div>
              </div>
              <div>
                <strong className="text-blue-900">Solo Requirements:</strong>
                <div className="ml-2 text-blue-700">
                  {selectedBigTeam === 'Import' && (
                    <>
                      • Sanaa must be alone from Team 2<br/>
                      • Fadwa must be alone from Team 3<br/>
                    </>
                  )}
                  {selectedBigTeam === 'Administration' && (
                    <>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Status Panel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Total People</h3>
              </div>
              <p className="text-2xl font-bold text-blue-600">{getCurrentPeople().length}</p>
              <p className="text-sm text-blue-700">Across {getCurrentSubTeams().length} sub-teams</p>
            </div>

            <div className={`border rounded-lg p-4 ${constraints.violations.length > 0 ? 'bg-red-50 border-red-200' : unscheduledPeople.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {constraints.violations.length > 0 || unscheduledPeople.length > 0 ?
                  <AlertTriangle className="w-5 h-5 text-yellow-600" /> :
                  <CheckCircle className="w-5 h-5 text-green-600" />
                }
                <h3 className="font-semibold">Constraints</h3>
              </div>
              {constraints.violations.length > 0 && (
                <div className="text-red-700 text-sm mb-2">
                  <strong>Violations:</strong>
                  {constraints.violations.map((v, i) => <div key={i}>• {v}</div>)}
                </div>
              )}
              {constraints.warnings.length > 0 && (
                <div className="text-yellow-700 text-sm mb-2">
                  <strong>Warnings:</strong>
                  {constraints.warnings.map((w, i) => <div key={i}>• {w}</div>)}
                </div>
              )}
              {constraints.violations.length === 0 && constraints.warnings.length === 0 && (
                <p className="text-green-700 text-sm">All constraints satisfied!</p>
              )}
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">Distribution</h3>
              </div>
              {timeSlots.map(slot => (
                <div key={slot.id} className="flex justify-between text-sm">
                  <span>{slot.time}</span>
                  <span className="font-medium">{filteredSchedule[slot.id]?.length || 0} people</span>
                </div>
              ))}
            </div>
          </div>

          {/* Unscheduled People */}
          {unscheduledPeople.length > 0 && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="font-semibold text-yellow-800 mb-2">Unscheduled People ({unscheduledPeople.length})</h3>
              <div className="flex flex-wrap gap-2">
                {unscheduledPeople.map(person => {
                  const team = getPersonTeam(person);
                  const member = members.find(m => m.name === person);
                  return (
                    <div
                      key={person}
                      draggable={isAdmin}
                      onDragStart={(e) => handleDragStart(e, { 
                        name: person, 
                        memberId: member?.id,
                        id: `unscheduled-${person}`
                      })}
                      className={`px-3 py-1 rounded-full text-sm font-medium ${isAdmin ? 'cursor-move' : 'cursor-default'} border ${team?.color || 'bg-gray-100 text-gray-800 border-gray-200'}`}
                    >
                      {person}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Schedule Grid (Mon–Thu) */}
      <div className="mb-10">
        <h2 className="text-xl font-bold mb-2">Mon–Thu Schedule</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {timeSlots.map(slot => (
            <div
              key={slot.id}
              className={`bg-white border-2 rounded-lg p-4 min-h-[300px] ${isAdmin ? 'border-dashed border-gray-300' : 'border-solid border-gray-200'}`}
              onDragOver={isAdmin ? handleDragOver : undefined}
              onDrop={isAdmin ? (e) => handleDrop(e, slot.id) : undefined}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{slot.time}</h3>
                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-sm">
                  {filteredSchedule[slot.id]?.length || 0} people
                </span>
              </div>
            
              <div className="space-y-2">
                {filteredSchedule[slot.id]?.map(person => {
                  const team = getPersonTeam(person.name);
                  return (
                    <div
                      key={person.id}
                      draggable={isAdmin}
                      onDragStart={isAdmin ? (e) => handleDragStart(e, person, slot.id) : undefined}
                      className={`px-3 py-2 rounded-lg text-sm font-medium ${isAdmin ? 'cursor-move' : 'cursor-default'} border flex items-center justify-between ${team?.color || 'bg-gray-100 text-gray-800 border-gray-200'}`}
                    >
                      <span>{person.name}</span>
                      {isAdmin && (
                        <span className="text-xs opacity-75">{team?.name}</span>
                      )}
                    </div>
                  );
                })}
            
                {(!filteredSchedule[slot.id] || filteredSchedule[slot.id].length === 0) && isAdmin && (
                  <div className="text-center text-gray-400 py-8">
                    Drop people here
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Unscheduled People for Friday */}
      {isAdmin && getUnscheduledFridayPeople().length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-2">Unscheduled People for Friday ({getUnscheduledFridayPeople().length})</h3>
          <div className="flex flex-wrap gap-2">
            {getUnscheduledFridayPeople().map(person => {
              const team = getPersonTeam(person);
              const member = members.find(m => m.name === person);
              return (
                <div
                  key={person + '-friday'}
                  draggable={isAdmin}
                  onDragStart={(e) => handleDragStart(e, {
                    name: person,
                    memberId: member?.id,
                    id: `unscheduled-friday-${person}`
                  })}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${isAdmin ? 'cursor-move' : 'cursor-default'} border ${team?.color || 'bg-gray-100 text-gray-800 border-gray-200'}`}
                >
                  {person}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Friday Schedule Grid */}
      <div className="mb-10">
        <h2 className="text-xl font-bold mb-2">Friday Schedule</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {fridayTimeSlots.map(slot => (
            <div
              key={slot.id}
              className={`bg-white border-2 rounded-lg p-4 min-h-[300px] ${isAdmin ? 'border-dashed border-gray-300' : 'border-solid border-gray-200'}`}
              onDragOver={isAdmin ? handleDragOver : undefined}
              onDrop={isAdmin ? (e) => handleFridayDrop(e, slot.id) : undefined}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{slot.time}</h3>
                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-sm">
                  {getFilteredFridaySchedule()[slot.id]?.length || 0} people
                </span>
              </div>
              <div className="space-y-2">
                {getFilteredFridaySchedule()[slot.id]?.map(person => {
                  const team = getPersonTeam(person.name);
                  return (
                    <div
                      key={person.id}
                      draggable={isAdmin}
                      onDragStart={isAdmin ? (e) => handleDragStart(e, person, slot.id) : undefined}
                      className={`px-3 py-2 rounded-lg text-sm font-medium ${isAdmin ? 'cursor-move' : 'cursor-default'} border flex items-center justify-between ${team?.color || 'bg-gray-100 text-gray-800 border-gray-200'}`}
                    >
                      <span>{person.name}</span>
                      {isAdmin && (
                        <span className="text-xs opacity-75">{team?.name}</span>
                      )}
                    </div>
                  );
                })}
                {(!getFilteredFridaySchedule()[slot.id] || getFilteredFridaySchedule()[slot.id].length === 0) && isAdmin && (
                  <div className="text-center text-gray-400 py-8">
                    Drop people here
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Team Legend */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3">{selectedBigTeam} Teams</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {getCurrentSubTeams().map(team => (
            <div key={team.id} className="space-y-2">
              <div className={`px-3 py-1 rounded-full text-sm font-medium text-center border ${team.color}`}>
                {team.name}
              </div>
              <div className="text-xs text-gray-600">
                {team.members.map(member => (
                  <div key={member}>{member}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Team Modal */}
      {editingTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Edit Team</h2>
            <form onSubmit={handleUpdateTeam}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-1 text-sm">Team Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={editTeamData.name}
                  onChange={e => setEditTeamData({ ...editTeamData, name: e.target.value })}
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-1 text-sm">Department</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={editTeamData.department}
                  onChange={e => setEditTeamData({ ...editTeamData, department: e.target.value })}
                  list="edit-dept-suggestions"
                  required
                />
                <datalist id="edit-dept-suggestions">
                  {getDepartments().map(d => <option key={d} value={d} />)}
                </datalist>
              </div>
              {editTeamError && <div className="text-red-500 mb-4 text-sm">{editTeamError}</div>}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={savingTeam}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingTeam ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTeam(null)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Member Modal — name and department only; team assigned via drag */}
      {editingMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-1">Edit Member</h2>
            <p className="text-sm text-gray-500 mb-4">To change the team, drag the card to a different column.</p>
            <form onSubmit={handleSaveMember}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-1 text-sm">Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={editMemberData.name}
                  onChange={e => setEditMemberData({ ...editMemberData, name: e.target.value })}
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-1 text-sm">Department</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg"
                  value={editMemberData.bigTeam}
                  onChange={e => setEditMemberData({ ...editMemberData, bigTeam: e.target.value, team: '' })}
                >
                  <option value="">— none —</option>
                  {bigTeamOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              {editMemberError && <div className="text-red-500 mb-4 text-sm">{editMemberError}</div>}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={savingMember}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingMember ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Message Modal */}
      {showMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h2 className="text-xl font-bold mb-4">Team Message for {selectedBigTeam}</h2>
            <div className="bg-gray-50 p-4 rounded-lg mb-4 font-mono text-sm">
              <p className="mb-4">Hello {selectedBigTeam} team 👋, Here's the lunch break schedule. Everyone has 1 hour. Please respect your assigned time with <strong>maximum 15 minutes of delay</strong>. If any issue arises, let me know. Thanks!</p>
             
              {timeSlots.map(slot => (
                <div key={slot.id} className="mb-3">
                  <strong>{slot.time}:</strong>
                  {filteredSchedule[slot.id]?.map(person => (
                    <div key={person.id} className="ml-2">• {person.name}</div>
                  ))}
                </div>
              ))}
            </div>
           
            <div className="flex gap-3">
              <button
                onClick={copyMessage}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <Copy className="w-4 h-4" />
                Copy Message
              </button>
              <button
                onClick={() => setShowMessage(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;