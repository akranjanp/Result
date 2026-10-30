// server/timeSlots.js
// Generates and manages the 15-minute time slots between 08:30 AM and 11:00 PM (23:00) IST

const START_HOUR = 8;
const START_MIN = 30;
const END_HOUR = 23;
const END_MIN = 0;
const INTERVAL_MIN = 15;

/**
 * Extracts Indian Standard Time (IST, Asia/Kolkata) date and time parts regardless of server timezone
 */
function getISTParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = {};
  for (const { type, value } of formatter.formatToParts(date)) {
    parts[type] = value;
  }
  return {
    hours: parseInt(parts.hour, 10),
    minutes: parseInt(parts.minute, 10),
    seconds: parseInt(parts.second, 10),
    day: parts.day,
    month: parts.month,
    year: parts.year,
    displayDate: `${parts.day}-${parts.month}-${parts.year}`,
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
    timeStr: `${parts.hour}:${parts.minute}`
  };
}

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
 * Checks if a given Date is within operating hours (08:30 - 23:00 IST)
 */
function isWithinOperatingHours(date = new Date()) {
  const ist = getISTParts(date);
  const totalMin = ist.hours * 60 + ist.minutes;
  const startMin = START_HOUR * 60 + START_MIN;
  const endMin = END_HOUR * 60 + END_MIN;
  return totalMin >= startMin && totalMin <= endMin;
}

/**
 * Returns the current active slot (e.g. at 11:05, returns '11:00'; at 08:32, returns '08:30') in IST
 */
function getCurrentSlot(date = new Date()) {
  const ist = getISTParts(date);
  const totalMin = ist.hours * 60 + ist.minutes;
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
 * Returns formatted date string 'DD-MM-YYYY' and 'YYYY-MM-DD' in IST
 */
function getDateStrings(date = new Date()) {
  const ist = getISTParts(date);
  return {
    display: ist.displayDate,
    iso: ist.isoDate
  };
}

module.exports = {
  getAllSlots,
  format12Hour,
  isWithinOperatingHours,
  getCurrentSlot,
  getDateStrings,
  getISTParts
};
