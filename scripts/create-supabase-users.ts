// dotenv must load via side-effect import so it runs BEFORE ../src/lib/prisma
// is evaluated (import declarations are hoisted above module body code)
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { Role } from "@prisma/client";

// Important: Next.js tsconfig paths might not work perfectly with plain tsx unless configured,
// so we'll use a relative path to the lib.
import prisma from "../src/lib/prisma";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase URL or Service Key");
  process.exit(1);
}

// Create a Supabase client with the service role key for admin privileges
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const TEST_USERS = [
  { email: "student@university.edu", name: "Aarav Sharma", role: "STUDENT" as Role },
  { email: "faculty@university.edu", name: "Dr. Priya Mehta", role: "FACULTY" as Role },
  { email: "hr@company.com", name: "Riya Kapoor", role: "HR" as Role },
  { email: "manager@university.edu", name: "Prof. Vikram Singh", role: "MANAGER" as Role },
  { email: "admin@university.edu", name: "Neha Gupta", role: "ADMIN" as Role },
  { email: "superadmin@university.edu", name: "Rajesh Kumar", role: "SUPER_ADMIN" as Role },
  { email: "parent@university.edu", name: "Suresh Sharma", role: "PARENT" as Role },
  { email: "executive@university.edu", name: "Dr. Anil Desai", role: "EXECUTIVE" as Role },
];

const DEFAULT_PASSWORD = "Password123!";

async function main() {
  console.log("Seeding test users into Supabase Auth and linking to Prisma...");

  for (const testUser of TEST_USERS) {
    console.log(`Processing ${testUser.email}...`);
    
    // 1. Create or retrieve the user in Supabase Auth via Admin API
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: testUser.email,
      password: DEFAULT_PASSWORD,
      email_confirm: true, // Bypass email confirmation since we are admin
      user_metadata: {
        name: testUser.name,
      }
    });

    let supabaseUid: string;

    if (error) {
      if (error.message.includes("already been registered") || error.message.includes("already registered") || error.code === "user_already_exists") {
        console.log(` - User ${testUser.email} already exists in Supabase. Fetching UUID...`);
        // We have to list users to find the ID if they already exist
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existing = listData.users.find(u => u.email === testUser.email);
        if (!existing) {
          console.error(` - Failed to find existing user ${testUser.email}`);
          continue;
        }
        supabaseUid = existing.id;
      } else {
        console.error(` - Error creating ${testUser.email}:`, error.message);
        continue;
      }
    } else {
      console.log(` - Created new user in Supabase Auth: ${testUser.email}`);
      supabaseUid = data.user.id;
    }

    // 2. Link/Upsert the user in Prisma
    const dbUser = await prisma.user.upsert({
      where: { email: testUser.email },
      update: {
        supabaseUid,
        name: testUser.name,
        role: testUser.role,
        isActive: true,
      },
      create: {
        email: testUser.email,
        name: testUser.name,
        role: testUser.role,
        supabaseUid,
        isActive: true,
      }
    });
    
    console.log(` - Linked to Prisma User ID: ${dbUser.id} with Role: ${dbUser.role}`);
  }

  console.log("\nAll test users seeded successfully!");
  console.log(`Login Password for all accounts: ${DEFAULT_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
