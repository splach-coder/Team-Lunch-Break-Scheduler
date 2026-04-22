import Airtable from 'airtable';

const base = new Airtable({ apiKey: import.meta.env.VITE_AIRTABLE_API_KEY }).base(import.meta.env.VITE_AIRTABLE_BASE_ID);

// Fetch all members
export const fetchMembers = async () => {
  try {
    const records = await base('Members Table').select().all();
    return records.map(rec => ({
      id: rec.id,
      name: rec.get('Name'),
      team: rec.get('Team'),
      bigTeam: rec.get('Big Team'),
    }));
  } catch (error) {
    console.error('Error fetching members:', error);
    return [];
  }
};

// Fetch all schedule entries (with expanded member info)
export const fetchSchedule = async () => {
  try {
    const records = await base('Schedule Table').select({
      view: 'Grid view',
      expand: ['Member']
    }).all();
    
    return records.map(rec => ({
      id: rec.id,
      memberId: rec.get('Member')?.[0] || null,
      memberName: rec.get('Name (from Member)')?.[0] || null,
      timeSlot: rec.get('Time Slot'),
      day: rec.get('Day') || 'Mon–Thu',
    }));
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return [];
  }
};

// Fetch schedule entries for a specific day
export const fetchScheduleByDay = async (day) => {
  try {
    const records = await base('Schedule Table').select({
      view: 'Grid view',
      filterByFormula: `{Day} = '${day}'`,
      expand: ['Member']
    }).all();
    return records.map(rec => ({
      id: rec.id,
      memberId: rec.get('Member')?.[0] || null,
      memberName: rec.get('Name (from Member)')?.[0] || null,
      timeSlot: rec.get('Time Slot'),
      day: rec.get('Day') || 'Mon–Thu',
    }));
  } catch (error) {
    console.error('Error fetching schedule by day:', error);
    return [];
  }
};

export const updateSchedule = async (scheduleId, newTimeSlot, day = 'Mon–Thu') => {
  try {
    await base('Schedule Table').update([
      {
        id: scheduleId,
        fields: { 'Time Slot': newTimeSlot, 'Day': day }
      }
    ]);
    return { success: true };
  } catch (error) {
    console.error('Error updating schedule:', error);
    return { success: false, error };
  }
};

export const createSchedule = async (memberId, timeSlot, day = 'Mon–Thu', id = null) => {
  try {
    const fields = {
      'Member': [memberId],
      'Time Slot': timeSlot,
      'Day': day
    };
    if (id !== null) {
      fields['ID'] = String(id);
    }
    const record = await base('Schedule Table').create([
      {
        fields
      }
    ]);
    return { 
      success: true,
      id: record[0].id
    };
  } catch (error) {
    console.error('Error creating schedule:', error);
    return { success: false, error };
  }
};

export const deleteSchedule = async (scheduleId) => {
  try {
    await base('Schedule Table').destroy(scheduleId);
    return { success: true };
  } catch (error) {
    console.error('Error deleting schedule:', error);
    return { success: false, error };
  }
};

export const createMember = async (name, team, bigTeam) => {
  try {
    const record = await base('Members Table').create([
      {
        fields: {
          'Name': name,
          'Team': team,
          'Big Team': bigTeam
        }
      }
    ]);
    return { success: true, id: record[0].id };
  } catch (error) {
    console.error('Error creating member:', error);
    return { success: false, error };
  }
};

export const updateMember = async (memberId, name, team, bigTeam) => {
  try {
    await base('Members Table').update([{
      id: memberId,
      fields: { 'Name': name, 'Team': team, 'Big Team': bigTeam }
    }]);
    return { success: true };
  } catch (error) {
    console.error('Error updating member:', error);
    return { success: false, error };
  }
};

export const deleteMember = async (memberId) => {
  try {
    await base('Members Table').destroy(memberId);
    return { success: true };
  } catch (error) {
    console.error('Error deleting member:', error);
    return { success: false, error };
  }
};

// Teams Table CRUD
export const fetchTeams = async () => {
  try {
    const records = await base('Teams Table').select().all();
    return records.map(rec => ({
      id: rec.id,
      name: rec.get('Name'),
      department: rec.get('Department'),
    }));
  } catch (error) {
    console.error('Error fetching teams:', error);
    return [];
  }
};

export const createTeam = async (name, department) => {
  try {
    const record = await base('Teams Table').create([{ fields: { 'Name': name, 'Department': department } }]);
    return { success: true, id: record[0].id };
  } catch (error) {
    console.error('Error creating team:', error);
    return { success: false, error };
  }
};

export const updateTeam = async (teamId, name, department) => {
  try {
    await base('Teams Table').update([{ id: teamId, fields: { 'Name': name, 'Department': department } }]);
    return { success: true };
  } catch (error) {
    console.error('Error updating team:', error);
    return { success: false, error };
  }
};

export const deleteTeam = async (teamId) => {
  try {
    await base('Teams Table').destroy(teamId);
    return { success: true };
  } catch (error) {
    console.error('Error deleting team:', error);
    return { success: false, error };
  }
};
