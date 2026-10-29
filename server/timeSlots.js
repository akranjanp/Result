// server/timeSlots.js
// Generates and manages the 15-minute time slots between 08:30 AM and 11:00 PM (23:00)

const START_HOUR = 8;
const START_MIN = 30;
const END_HOUR = 23;
const END_MIN = 0;
const INTERVAL_MIN = 15;

/**
 * Returns an array of formatted slot strings: ['08:30', '08:45', ..., '23:00']
 */
function getAllSlots() {
  const slots = [];
  let currentMinutes = START_HOUR * 60 + START_MIN;
  const endMinutes = END_HOUR * 60 + END_MIN;

  while (currentMinutes <= endMinutes) {
    const h = Math.floor(currentMinutes / 60);
    const m = currentMinutes % 60;
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    slots.push(timeStr);
    currentMinutes += INTERVAL_MIN;
  }
  return slots;
}

/**
 * Converts a slot 'HH:mm' to 12-hour display string 'hh:mm AM/PM'
 */
function format12Hour(timeStr) {
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  return `${String(h).padStart(2, '0')}:${mStr} ${ampm}`;
}

/**
 * Checks if a given Date (or current time in IST/local) is within operating hours (08:30 - 23:00)
 */
function isWithinOperatingHours(date = new Date()) {
  const totalMin = date.getHours() * 60 + date.getMinutes();
  const startMin = START_HOUR * 60 + START_MIN;
  const endMin = END_HOUR * 60 + END_MIN;
  return totalMin >= startMin && totalMin <= endMin;
}

/**
 * Returns the current active slot (e.g. at 11:05, returns '11:00'; at 08:32, returns '08:30')
 */
function getCurrentSlot(date = new Date()) {
  const totalMin = date.getHours() * 60 + date.getMinutes();
  const startMin = START_HOUR * 60 + START_MIN;
  const endMin = END_HOUR * 60 + END_MIN;

  if (totalMin < startMin) {
    return null; // Before start
  }
  if (totalMin > endMin) {
    return null; // After end
  }

  // Calculate the floor slot
  const diff = totalMin - startMin;
  const slotIndex = Math.floor(diff / INTERVAL_MIN);
  const currentSlotMin = startMin + (slotIndex * INTERVAL_MIN);

  const h = Math.floor(currentSlotMin / 60);
  const m = currentSlotMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Returns formatted date string 'DD-MM-YYYY' and 'YYYY-MM-DD'
 */
function getDateStrings(date = new Date()) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();

  return {
    display: `${d}-${m}-${y}`, // 26-10-2026 format matching screenshots
    iso: `${y}-${m}-${d}`      // 2026-10-26 database format
  };
}

module.exports = {
  getAllSlots,
  format12Hour,
  isWithinOperatingHours,
  getCurrentSlot,
  getDateStrings
};
