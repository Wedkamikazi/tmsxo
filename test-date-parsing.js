// Test date parsing logic
function formatDate(dateString) {
  console.log(`Testing date: "${dateString}"`);
  
  // Handle slash-separated dates
  if (dateString.includes('/')) {
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const part1 = parseInt(parts[0]);
      const part2 = parseInt(parts[1]);
      const year = parseInt(parts[2]);
      
      // Log for debugging
      if (isNaN(part1) || isNaN(part2) || isNaN(year)) {
        console.warn(`Invalid date parts in formatDate: "${dateString}" -> [${part1}, ${part2}, ${year}]`);
        return dateString; // Return original if parsing fails
      }
      
      let month, day;
      
      // Determine if it's MM/DD/YYYY or DD/MM/YYYY format
      if (part1 > 12) {
        // DD/MM/YYYY format
        day = part1;
        month = part2;
        console.log(`  -> DD/MM/YYYY format: day=${day}, month=${month}, year=${year}`);
      } else if (part2 > 12) {
        // MM/DD/YYYY format
        month = part1;
        day = part2;
        console.log(`  -> MM/DD/YYYY format: day=${day}, month=${month}, year=${year}`);
      } else {
        // Ambiguous - assume DD/MM/YYYY (European format) based on user's bank CSV
        day = part1;
        month = part2;
        console.log(`  -> Ambiguous DD/MM/YYYY format: day=${day}, month=${month}, year=${year}`);
      }
      
      // Validate the date parts
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900) {
        // Convert to YYYY-MM-DD format
        const monthStr = month.toString().padStart(2, '0');
        const dayStr = day.toString().padStart(2, '0');
        const result = `${year}-${monthStr}-${dayStr}`;
        console.log(`  -> Result: ${result}`);
        
        // Test if the result creates a valid Date object
        const dateObj = new Date(result);
        console.log(`  -> Date object: ${dateObj}`);
        console.log(`  -> Is valid: ${!isNaN(dateObj.getTime())}`);
        
        return result;
      } else {
        console.log(`  -> Invalid date parts: day=${day}, month=${month}, year=${year}`);
      }
    }
  }
  
  console.log(`  -> Fallback to original: ${dateString}`);
  return dateString;
}

// Test with actual CSV dates
const testDates = [
  '1/1/2025',    // Single digit day/month
  '30/12/2024',  // Double digit day/month
  '10/12/2024',  // Double digit day/month
  '4/12/2024',   // Single digit day
  '17/12/2024',  // Double digit day/month
  '3/12/2024',   // Single digit day
  '2/12/2024',   // Single digit day & month
];

testDates.forEach(date => {
  console.log('='.repeat(50));
  formatDate(date);
  console.log('='.repeat(50));
}); 