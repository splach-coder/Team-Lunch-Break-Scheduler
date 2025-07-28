import Airtable from 'airtable';

// Configure with your Personal Access Token and Base ID
const base = new Airtable({ apiKey: 'patPBteF5BzJZyQR8.172c95ec558c7ed97a291c11ab236d4e518147d58742539d7d2806724b98b900' }).base('appf4tr0h9oso2roZ');

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
    }));
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return [];
  }
};

export const updateSchedule = async (scheduleId, newTimeSlot) => {
  try {
    await base('Schedule Table').update([
      {
        id: scheduleId,
        fields: { 'Time Slot': newTimeSlot }
      }
    ]);
    return { success: true };
  } catch (error) {
    console.error('Error updating schedule:', error);
    return { success: false, error };
  }
};

export const createSchedule = async (memberId, timeSlot) => {
  try {
    const record = await base('Schedule Table').create([
      {
        fields: {
          'Member': [memberId],
          'Time Slot': timeSlot
        }
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
