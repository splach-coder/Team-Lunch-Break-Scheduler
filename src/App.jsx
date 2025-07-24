import React, { useState, useMemo, useEffect } from 'react';
import { Clock, Users, CheckCircle, AlertTriangle, RotateCcw, Download, Copy, LogIn, LogOut, Lock, Eye, Filter, ChevronDown, ChevronUp } from 'lucide-react';

const App = () => {
  // Teams data - now organized with big teams and sub-teams
  const teamStructure = {
    "Import": [
      { id: 1, name: 'Team 1', members: ['Simo', 'Mustapha', 'Khadija'], color: 'bg-blue-100 text-blue-800 border-blue-200' },
      { id: 2, name: 'Team 2', members: ['Ayoub', 'Sanaa', 'Aymane', 'Zakaria'], color: 'bg-green-100 text-green-800 border-green-200' },
      { id: 3, name: 'Team 3', members: ['Houda', 'Fadwa', 'Amina B', 'Oumaima'], color: 'bg-purple-100 text-purple-800 border-purple-200' },
      { id: 4, name: 'Team 4', members: ['Zohra', 'Hind'], color: 'bg-orange-100 text-orange-800 border-orange-200' },
      { id: 5, name: 'Team 5', members: ['Yahya', 'Mehdi', 'Youssef', 'Hamza'], color: 'bg-pink-100 text-pink-800 border-pink-200' }
    ],
    "Export": [
      { id: 6, name: 'Team 1', members: ['Mourad', 'chaimae', 'Dija' ], color: 'bg-red-100 text-red-800 border-red-200' },
      { id: 7, name: 'Team 2', members: ['Aya', 'Zahira', 'Fatima zahra'], color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
      { id: 11, name: 'Team 2', members: ['Mouhsin' , 'Ikram', 'Hafida'], color: 'bg-green-100 text-green-800 border-green-200' }
    ],
    "Administration": [
      { id: 8, name: 'Team 1', members: ['Salma', "Amina"], color: 'bg-teal-100 text-teal-800 border-teal-200' },
      { id: 9, name: 'Team 2', members: ['Fatima zahra Her', 'Wissal'], color: 'bg-amber-100 text-amber-800 border-amber-200' },
      { id: 10, name: 'Team 3', members: ['Fatima zahra ben',], color: 'bg-green-100 text-green-800 border-green-200' }
    ]
  };

  const timeSlots = [
    { id: 1, time: '12:00–13:00', start: '12:00', end: '13:00' },
    { id: 2, time: '13:00–14:00', start: '13:00', end: '14:00' },
    { id: 3, time: '14:00–15:00', start: '14:00', end: '15:00' }
  ];

  // Initialize schedule with all teams
  const initialSchedule = {
    1: ['Mustapha', 'Zakaria', 'Oumaima', 'Youssef', 'Amina B', 'Ikram', 'Dija', 'Salma', "Amina"],
    2: ['Hafida', 'Aya', 'chaimae', 'Zohra', 'Fadwa', 'Khadija', 'Aymane', 'Ayoub', 'Hamza', 'Fatima zahra ben', 'Wissal'],
    3: ['Zahira', 'Mouhsin', 'Mourad', 'Fatima zahra Her', "Simo", "Mehdi", "Yahya", 'Sanaa', 'Hind', 'Houda']
  };

  // Special constraints - expanded for all teams
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
  const [schedule, setSchedule] = useState(initialSchedule);
  const [draggedPerson, setDraggedPerson] = useState(null);
  const [showMessage, setShowMessage] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [selectedBigTeam, setSelectedBigTeam] = useState('Import');
  const [expandedBigTeams, setExpandedBigTeams] = useState({
    Import: true,
    Export: false,
    Administration: false
  });

  // Check if user was previously logged in
  useEffect(() => {
    const savedAuth = localStorage.getItem('lunchSchedulerAuth');
    if (savedAuth) {
      setIsAdmin(true);
    }
  }, []);

  // Get all teams (flattened)
  const getAllTeams = () => {
    return Object.values(teamStructure).flat();
  };

  // Get all sub-teams for the selected big team
  const getCurrentSubTeams = () => {
    return teamStructure[selectedBigTeam] || [];
  };

  // Get all big team names
  const getBigTeamNames = () => {
    return Object.keys(teamStructure);
  };

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
        currentPeople.includes(person)
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
        const team = getPersonTeam(person);
        if (team) {
          teamCounts[team.id] = (teamCounts[team.id] || 0) + 1;
        }
      });
     
      Object.entries(teamCounts).forEach(([teamId, count]) => {
        const team = getCurrentSubTeams().find(t => t.id === parseInt(teamId));
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
        const conflictsInSlot = relevantGroup.filter(person => filteredSchedule[slotId].includes(person));
        if (conflictsInSlot.length > 1) {
          violations.push(`Conflict: ${conflictsInSlot.join(', ')} cannot be in the same time slot (${timeSlots.find(s => s.id.toString() === slotId)?.time})`);
        }
      });
    });

    // Check solo requirements
    specialConstraints.soloRequirements.forEach(({ person, team }) => {
      if (!currentPeople.includes(person)) return;
      
      Object.keys(filteredSchedule).forEach(slotId => {
        if (filteredSchedule[slotId].includes(person)) {
          const teamMatesInSlot = filteredSchedule[slotId].filter(p => {
            const pTeam = getPersonTeam(p);
            return pTeam && pTeam.name === team && p !== person;
          });
          if (teamMatesInSlot.length > 0) {
            violations.push(`${person} must be alone from ${team} but is with: ${teamMatesInSlot.join(', ')}`);
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
    const scheduledPeople = getScheduledPeople();
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

  const handleDrop = (e, toSlot) => {
    if (!isAdmin) return;
    e.preventDefault();
    if (!draggedPerson) return;

    const { person, fromSlot } = draggedPerson;
   
    setSchedule(prev => {
      const newSchedule = { ...prev };
     
      // Remove from original slot if exists
      if (fromSlot) {
        newSchedule[fromSlot] = newSchedule[fromSlot].filter(p => p !== person);
      }
     
      // Add to new slot if not already there
      if (!newSchedule[toSlot].includes(person)) {
        newSchedule[toSlot] = [...newSchedule[toSlot], person];
      }
     
      return newSchedule;
    });
   
    setDraggedPerson(null);
  };

  const autoOptimize = () => {
    if (!isAdmin) return;
    
    const allPeople = getCurrentPeople();
    const newSchedule = { 1: [], 2: [], 3: [] };
   
    // Handle special constraints first for the current big team
    if (selectedBigTeam === 'Import') {
      // Place Sanaa alone from Team 2
      newSchedule[1].push('Sanaa');
     
      // Place Fadwa alone from Team 3 
      newSchedule[2].push('Fadwa');
     
      // Place Zohra (can't be with Sanaa or Fadwa)
      newSchedule[2].push('Zohra');
     
      // Separate Mehdi and Hamza
      newSchedule[1].push('Mehdi');
      newSchedule[3].push('Hamza');
    } else if (selectedBigTeam === 'Administration') {
      // Place Samira alone from HR
      newSchedule[3].push('Fatima zahra ben');
     
      // Separate Ali and Farida
      newSchedule[1].push('Fatima zahra ben');
      newSchedule[2].push('Fatima zahra Her');
      newSchedule[2].push('Salma');
    }
   
    // Now place remaining people
    const placedPeople = newSchedule[1].concat(newSchedule[2], newSchedule[3]);
    const remainingPeople = allPeople.filter(person => !placedPeople.includes(person));
   
    // Sort remaining by teams to distribute evenly
    const teamGroups = {};
    remainingPeople.forEach(person => {
      const team = getPersonTeam(person);
      if (!teamGroups[team.id]) teamGroups[team.id] = [];
      teamGroups[team.id].push(person);
    });
   
    // Distribute remaining people trying to balance slots
    let slotIndex = 0;
    const slots = [1, 2, 3];
   
    Object.values(teamGroups).forEach(teamMembers => {
      teamMembers.forEach(person => {
        // Find best slot for this person
        let bestSlot = slots[slotIndex % 3];
       
        // Avoid putting Team 2 members with Sanaa
        const personTeam = getPersonTeam(person);
        if (selectedBigTeam === 'Import' && personTeam.name === 'Team 2' && newSchedule[1].includes('Sanaa')) {
          bestSlot = newSchedule[2].length <= newSchedule[3].length ? 2 : 3;
        }
        // Avoid putting Team 3 members with Fadwa 
        else if (selectedBigTeam === 'Import' && personTeam.name === 'Team 3' && newSchedule[2].includes('Fadwa')) {
          bestSlot = newSchedule[1].length <= newSchedule[3].length ? 1 : 3;
        }
        // Avoid putting HR members with Samira
        else if (selectedBigTeam === 'Administration' && personTeam.name === 'Team 3' && newSchedule[3].includes('Fatima zahra ben')) {
          bestSlot = newSchedule[1].length <= newSchedule[2].length ? 1 : 2;
        }
       
        newSchedule[bestSlot].push(person);
        slotIndex++;
      });
    });
   
    // Update the full schedule while preserving other teams' assignments
    setSchedule(prev => {
      const updatedSchedule = { ...prev };
      Object.keys(newSchedule).forEach(slotId => {
        // Remove current team's people from the slot
        updatedSchedule[slotId] = updatedSchedule[slotId].filter(person => 
          !allPeople.includes(person)
        );
        // Add the newly scheduled people
        updatedSchedule[slotId] = [...updatedSchedule[slotId], ...newSchedule[slotId]];
      });
      return updatedSchedule;
    });
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
  `${slot.time}:\n${filteredSchedule[slot.id].map(person => `• ${person}`).join('\n')}`
).join('\n\n')}`;
   
    navigator.clipboard.writeText(message);
    alert('Message copied to clipboard!');
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (loginData.username === 'admin' && loginData.password === 'admin') {
      setIsAdmin(true);
      setLoginOpen(false);
      setLoginError('');
      localStorage.setItem('lunchSchedulerAuth', 'true');
    } else {
      setLoginError('Invalid credentials. Use admin/admin for demo.');
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem('lunchSchedulerAuth');
  };

  const toggleBigTeam = (bigTeam) => {
    setExpandedBigTeams(prev => ({
      ...prev,
      [bigTeam]: !prev[bigTeam]
    }));
  };

  const constraints = getTeamConstraintStatus();
  const unscheduledPeople = getUnscheduledPeople();
  const filteredSchedule = getFilteredSchedule();

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
                  <span className="font-medium">{filteredSchedule[slot.id].length} people</span>
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
                  return (
                    <div
                      key={person}
                      draggable={isAdmin}
                      onDragStart={(e) => handleDragStart(e, person)}
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

      {/* Schedule Grid */}
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
                {filteredSchedule[slot.id].length} people
              </span>
            </div>
           
            <div className="space-y-2">
              {filteredSchedule[slot.id].map(person => {
                const team = getPersonTeam(person);
                return (
                  <div
                    key={person}
                    draggable={isAdmin}
                    onDragStart={isAdmin ? (e) => handleDragStart(e, person, slot.id) : undefined}
                    className={`px-3 py-2 rounded-lg text-sm font-medium ${isAdmin ? 'cursor-move' : 'cursor-default'} border flex items-center justify-between ${team?.color || 'bg-gray-100 text-gray-800 border-gray-200'}`}
                  >
                    <span>{person}</span>
                    {isAdmin && (
                      <span className="text-xs opacity-75">{team?.name}</span>
                    )}
                  </div>
                );
              })}
             
              {filteredSchedule[slot.id].length === 0 && isAdmin && (
                <div className="text-center text-gray-400 py-8">
                  Drop people here
                </div>
              )}
            </div>
          </div>
        ))}
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
                  {filteredSchedule[slot.id].map(person => (
                    <div key={person} className="ml-2">• {person}</div>
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