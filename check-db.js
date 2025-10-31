require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkStreams() {
  try {
    console.log('🔍 Checking streams in database...\n');
    
    // Check total number of streams
    const streamCount = await prisma.stream.count();
    console.log(`📊 Total streams in database: ${streamCount}`);
    
    if (streamCount > 0) {
      // Get all streams with user details
      const streams = await prisma.stream.findMany({
        include: {
          payer: true,
          recipient: true
        },
        take: 10 // Limit to first 10
      });
      
      console.log('\n📋 Stream details:');
      streams.forEach((stream, index) => {
        console.log(`\nStream ${index + 1}:`);
        console.log(`  ID: ${stream.id}`);
        console.log(`  Payer: ${stream.payer?.walletAddress || 'N/A'} (${stream.payer?.name || 'Unnamed'})`);
        console.log(`  Recipient: ${stream.recipient?.walletAddress || 'N/A'} (${stream.recipient?.name || 'Unnamed'})`);
        console.log(`  Amount: ${stream.totalAmount} ${stream.tokenAddress}`);
        console.log(`  Status: ${stream.status}`);
        console.log(`  Created: ${stream.createdAt}`);
        console.log(`  On-chain ID: ${stream.onChainStreamId || 'Not set'}`);
      });
    }
    
    // Check users
    const userCount = await prisma.user.count();
    console.log(`\n👥 Total users in database: ${userCount}`);
    
    if (userCount > 0) {
      const users = await prisma.user.findMany({
        take: 5
      });
      
      console.log('\n👤 Recent users:');
      users.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.walletAddress} (${user.name || 'Unnamed'}) - Type: ${user.userType}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStreams();