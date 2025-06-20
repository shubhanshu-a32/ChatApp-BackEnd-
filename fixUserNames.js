import mongoose from 'mongoose';
import User from './models/User.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ChatApp+';

async function fixUserNames() {
  await mongoose.connect(MONGO_URI);

  const users = await User.find({ $or: [{ name: { $exists: false } }, { name: '' }] });

  for (const user of users) {
    user.name = user.email.split('@')[0] || `User${user._id.toString().slice(-4)}`;
    await user.save();
    console.log(`Updated user ${user.email} with name: ${user.name}`);
  }

  console.log('Done!');
  process.exit(0);
}

fixUserNames().catch(err => {
  console.error(err);
  process.exit(1);
}); 