'use strict';

function isValidTimeZone(timeZone) {
  if (!timeZone || typeof timeZone !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function localDateParts(date, timeZone) {
  if (!isValidTimeZone(timeZone)) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function isWeeklyDigestSendTime(date, timeZone) {
  const parts = localDateParts(date, timeZone);
  return parts?.weekday === 'Mon' && parts?.hour === '08';
}

function localPeriodKey(date, timeZone) {
  const parts = localDateParts(date, timeZone);
  if (!parts) return null;
  return `${parts.year}-${parts.month}-${parts.day}`;
}

module.exports = {
  isValidTimeZone,
  isWeeklyDigestSendTime,
  localPeriodKey,
};
