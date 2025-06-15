// Test postDateTime creation with actual CSV dates
const testDates = [
  { postDate: '17/12/2024', time: '11:55' },
  { postDate: '4/12/2024', time: '14:25' },
  { postDate: '1/1/2025', time: '11:27' },
  { postDate: '30/12/2024', time: '15:21' },
  { postDate: '3/12/2024', time: '09:30' },
];

// Simulate the formatDate function from csvProcessingService
function formatDate(dateString) {
  console.log(`\n=== Testing formatDate with: "${dateString}" ===`);
  
  // Handle slash-separated dates
  if (dateString.includes('/')) {
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const part1 = parseInt(parts[0]);
      const part2 = parseInt(parts[1]);
      const year = parseInt(parts[2]);
      
      console.log(`Parts: [${part1}, ${part2}, ${year}]`);
      
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
        console.log(`DD/MM/YYYY format: day=${day}, month=${month}, year=${year}`);
      } else if (part2 > 12) {
        // MM/DD/YYYY format
        month = part1;
        day = part2;
        console.log(`MM/DD/YYYY format: day=${day}, month=${month}, year=${year}`);
      } else {
        // Ambiguous - assume DD/MM/YYYY (European format) based on user's bank CSV
        day = part1;
        month = part2;
        console.log(`Ambiguous DD/MM/YYYY format: day=${day}, month=${month}, year=${year}`);
      }
      
      // Validate the date parts
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900) {
        // Convert to YYYY-MM-DD format
        const monthStr = month.toString().padStart(2, '0');
        const dayStr = day.toString().padStart(2, '0');
        const result = `${year}-${monthStr}-${dayStr}`;
        console.log(`✅ Formatted result: ${result}`);
        return result;
      } else {
        console.log(`❌ Invalid date parts: day=${day}, month=${month}, year=${year}`);
      }
    }
  }
  
  console.log(`❌ Fallback to original: ${dateString}`);
  return dateString;
}

// Test postDateTime creation
testDates.forEach(testData => {
  console.log('\n' + '='.repeat(60));
  console.log(`Testing: postDate="${testData.postDate}", time="${testData.time}"`);
  
  // Step 1: Format the date
  const formattedDate = formatDate(testData.postDate);
  console.log(`Step 1 - Formatted date: ${formattedDate}`);
  
  // Step 2: Create postDateTime (simulating BankStatementImport.tsx logic)
  const postDateTime = `${formattedDate}T${testData.time || '00:00'}:00`;
  console.log(`Step 2 - postDateTime: ${postDateTime}`);
  
  // Step 3: Test if it creates a valid Date object
  const dateObj = new Date(postDateTime);
  console.log(`Step 3 - Date object: ${dateObj}`);
  console.log(`Step 4 - Is valid: ${!isNaN(dateObj.getTime())}`);
  
  // Step 5: Test formatting (simulating Transactions.tsx formatDate)
  if (!isNaN(dateObj.getTime())) {
    const displayDate = dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    console.log(`Step 5 - Display format: ${displayDate}`);
  } else {
    console.log(`Step 5 - ❌ INVALID DATE - This would show "Invalid Date" in UI`);
  }
  
  console.log('='.repeat(60));
}); 