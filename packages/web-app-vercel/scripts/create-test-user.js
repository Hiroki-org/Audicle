const dns = require("node:dns");
dns.setDefaultResultOrder("ipv4first");
require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env.local"),
});

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase environment variables not set");
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestUser() {
  const testUserId = "test-user-id-123";

  // Check if user already exists
  const { data: existing, error: checkError } = await supabase
    .from("user_settings")
    .select("user_id")
    .eq("user_id", testUserId)
    .single();

  if (existing) {
    console.log("Test user already exists");
    return;
  }

  // Create test user
  const { data, error } = await supabase
    .from("user_settings")
    .insert({
      user_id: testUserId,
      playback_speed: 1.0,
      voice_model: "ja-JP-Standard-B",
      language: "ja-JP",
    })
    .select();

  if (error) {
    console.error("Error creating test user:", error);
  } else {
    console.log("Test user created:", data);
  }
}

createTestUser();
