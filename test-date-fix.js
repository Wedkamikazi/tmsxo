// Test script to verify date parsing fixes
const testDates = [
  '11/12/2024',  // Working dates
  '12/12/2024',
  '10/12/2024',
  '',            // Empty date (problematic)
  null,          // Null date (problematic)
  undefined,     // Undefined date (problematic)
  'invalid',     // Invalid date string
  '32/13/2024',  // Invalid day/month
  '1/1/2025',    // Single digit format
  '30/12/2024',  // Mixed format
];

// Simulate the formatDate function logic
function formatDate(dateString) {
  // Return current date if input is empty or invalid
  if (!dateString || dateString.toString().trim() === '') {
    console.warn(`Empty date string provided to formatDate, using current date`);
    return new Date().toISOString().split('T')[0];
  }
  
  // Handle slash-separated dates
  if (dateString.includes('/')) {
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const part1 = parseInt(parts[0]);
      const part2 = parseInt(parts[1]);
      const year = parseInt(parts[2]);
      
      // Log for debugging
      if (isNaN(part1) || isNaN(part2) || isNaN(year)) {
        console.warn(`Invalid date parts in formatDate: "${dateString}" -> [${part1}, ${part2}, ${year}], using current date`);
        return new Date().toISOString().split('T')[0];
      }
      
      let month, day;
      
      // Determine if it's MM/DD/YYYY or DD/MM/YYYY format
      if (part1 > 12) {
        // DD/MM/YYYY format
        day = part1;
        month = part2;
      } else if (part2 > 12) {
        // MM/DD/YYYY format
        month = part1;
        day = part2;
      } else {
        // Ambiguous - assume DD/MM/YYYY (European format)
        day = part1;
        month = part2;
      }
      
      // Validate the date parts
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900) {
        // Convert to YYYY-MM-DD format
        const monthStr = month.toString().padStart(2, '0');
        const dayStr = day.toString().padStart(2, '0');
        const formattedDate = `${year}-${monthStr}-${dayStr}`;
        
        // Verify the formatted date is valid
        const testDate = new Date(formattedDate);
        if (!isNaN(testDate.getTime())) {
          return formattedDate;
        }
      }
      
      console.warn(`Invalid date parts after validation: day=${day}, month=${month}, year=${year}, using current date`);
      return new Date().toISOString().split('T')[0];
    }
  }
  
  // Fallback to original logic with validation
  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (error) {
    console.warn(`Failed to parse date "${dateString}":`, error);
  }
  
  // Final fallback - use current date
  console.warn(`All date parsing failed for "${dateString}", using current date`);
  return new Date().toISOString().split('T')[0];
}

// Test postDateTime creation
function createPostDateTime(date, time) {
  const formattedDate = formatDate(date);
  const timeString = time || '00:00';
  return `${formattedDate}T${timeString}:00`;
}

console.log('=== Testing Date Parsing Fixes ===\n');

testDates.forEach((testDate, index) => {
  console.log(`Test ${index + 1}: Input = "${testDate}"`);
  try {
    const formatted = formatDate(testDate);
    const postDateTime = createPostDateTime(testDate, '09:30');
    const dateObj = new Date(postDateTime);
    
    console.log(`  Formatted: ${formatted}`);
    console.log(`  PostDateTime: ${postDateTime}`);
    console.log(`  Valid Date Object: ${!isNaN(dateObj.getTime())}`);
    console.log(`  Display Date: ${dateObj.toLocaleDateString()}`);
  } catch (error) {
    console.log(`  ERROR: ${error.message}`);
  }
  console.log('');
});

console.log('=== Test Complete ==='); 