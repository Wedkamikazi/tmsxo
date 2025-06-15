/**
 * Date utility functions for consistent datetime handling
 */

/**
 * Creates a properly formatted ISO datetime string from date and time strings
 * Ensures time is zero-padded (e.g., "8:55" becomes "08:55")
 * @param date - Date string in YYYY-MM-DD format
 * @param time - Time string in H:MM or HH:MM format (optional)
 * @returns ISO datetime string (YYYY-MM-DDTHH:MM:SS)
 */
export function createPostDateTime(date: string, time?: string): string {
  if (!date) {
    console.warn('createPostDateTime: No date provided, using current date');
    return new Date().toISOString();
  }

  // Default time to '00:00' if not provided
  let formattedTime = '00:00';
  
  if (time && time.trim()) {
    const cleanTime = time.trim();
    
    // Handle different time formats
    if (cleanTime.includes(':')) {
      const [hours, minutes] = cleanTime.split(':');
      // Zero-pad hours and minutes
      const paddedHours = hours.padStart(2, '0');
      const paddedMinutes = minutes.padStart(2, '0');
      formattedTime = `${paddedHours}:${paddedMinutes}`;
    } else if (cleanTime.length === 4) {
      // Handle HHMM format
      const hours = cleanTime.substring(0, 2);
      const minutes = cleanTime.substring(2);
      formattedTime = `${hours}:${minutes}`;
    } else {
      console.warn(`createPostDateTime: Invalid time format "${time}", using 00:00`);
      formattedTime = '00:00';
    }
  }

  // Create ISO datetime string
  const dateTimeString = `${date}T${formattedTime}:00`;
  
  // Validate the resulting datetime
  const dateObj = new Date(dateTimeString);
  if (isNaN(dateObj.getTime())) {
    console.warn(`createPostDateTime: Invalid datetime created "${dateTimeString}", using current date`);
    return new Date().toISOString();
  }

  return dateTimeString;
}

/**
 * Fixes existing postDateTime values that may have invalid time formatting
 * @param postDateTime - Existing postDateTime string that may be invalid
 * @returns Valid ISO datetime string
 */
export function fixPostDateTime(postDateTime: string): string {
  if (!postDateTime || postDateTime.trim() === '') {
    return new Date().toISOString();
  }

  // Check if it's already valid
  const testDate = new Date(postDateTime);
  if (!isNaN(testDate.getTime())) {
    return postDateTime; // Already valid
  }

  // Try to extract and fix the date/time parts
  if (postDateTime.includes('T')) {
    const [datePart, timePart] = postDateTime.split('T');
    const cleanTimePart = timePart.replace(':00', ''); // Remove seconds if present
    return createPostDateTime(datePart, cleanTimePart);
  }

  // Fallback to current datetime if unable to parse
  console.warn(`fixPostDateTime: Unable to fix datetime "${postDateTime}", using current date`);
  return new Date().toISOString();
} 